"""课程管理服务"""
import os
import json
import uuid
import shutil
from datetime import datetime
from io import BytesIO
from PyPDF2 import PdfReader
from app.models.base import db
from app.models.course import Course


class CourseService:
    """课程管理服务"""

    def __init__(self):
        # 课程目录路径
        self.courses_dir = os.getenv('COURSES_DIR', '/app/courses')

        # 确保目录存在
        os.makedirs(self.courses_dir, exist_ok=True)

    def _normalize_course(self, course: dict) -> dict:
        """标准化课程数据，确保必要字段存在"""
        # 确保 tags 字段存在
        if 'tags' not in course:
            course['tags'] = []
        # 移除已废弃的 category_id 字段
        if 'category_id' in course:
            del course['category_id']
        return course

    def get_all_courses(self) -> list:
        """获取所有课程"""
        courses = Course.query.order_by(Course.order).all()
        # 标准化每个课程数据
        return [self._normalize_course(c.to_dict()) for c in courses]

    def get_course(self, course_id: str) -> dict:
        """获取单个课程"""
        course = db.session.get(Course, course_id)
        if course:
            return self._normalize_course(course.to_dict())
        return None

    def create_course(self, title: str, description: str, pdf_content: bytes,
                      quiz_survey_id: str = None, pass_score: int = 60,
                      tags: list = None, prerequisites: list = None,
                      icon: str = None) -> dict:
        """
        创建新课程

        Args:
            title: 课程标题
            description: 课程描述
            pdf_content: PDF 文件内容
            quiz_survey_id: 关联的考卷 ID
            pass_score: 考卷及格分数

        Returns:
            新创建的课程信息
        """
        # 生成课程ID
        course_id = f"course-{uuid.uuid4().hex[:8]}"

        # 创建课程目录
        course_dir = os.path.join(self.courses_dir, course_id)
        os.makedirs(course_dir, exist_ok=True)

        # 保存 PDF 文件
        pdf_path = os.path.join(course_dir, 'content.pdf')
        with open(pdf_path, 'wb') as f:
            f.write(pdf_content)

        # 获取 PDF 页数
        try:
            reader = PdfReader(BytesIO(pdf_content))
            total_pages = len(reader.pages)
        except Exception:
            total_pages = 0

        # 估算阅读时长 (每页约 2 分钟)
        duration_minutes = max(5, total_pages * 2)

        # 获取下一个顺序号
        max_order = db.session.query(db.func.max(Course.order)).scalar() or 0
        next_order = max_order + 1

        # 创建课程模型实例
        course = Course(
            id=course_id,
            title=title,
            description=description,
            type='pdf',
            media_url=f'/api/courses/{course_id}/content.pdf',
            thumbnail_url=f'/courses/{course_id}/thumbnail.png',
            total_pages=total_pages,
            duration_minutes=duration_minutes,
            order=next_order,
            tags=json.dumps(tags or [], ensure_ascii=False),
            prerequisites=json.dumps(prerequisites or [], ensure_ascii=False),
            is_published=True,
            icon=icon,
            quiz_survey_id=quiz_survey_id,
            quiz_pass_score=pass_score if quiz_survey_id else None,
            created_at=datetime.utcnow()
        )

        # 保存到数据库
        db.session.add(course)
        db.session.commit()

        return course.to_dict()

    def update_course(self, course_id: str, updates: dict) -> dict:
        """
        更新课程信息

        Args:
            course_id: 课程 ID
            updates: 要更新的字段

        Returns:
            更新后的课程信息
        """
        course = db.session.get(Course, course_id)
        if not course:
            return None

        # 允许更新的字段
        allowed_fields = ['title', 'description', 'order', 'quiz', 'isLocked',
                          'tags', 'prerequisites', 'is_published', 'icon']

        for field in allowed_fields:
            if field in updates:
                if field == 'quiz':
                    # Handle quiz object - split into quiz_survey_id and quiz_pass_score
                    quiz_data = updates[field]
                    if quiz_data:
                        course.quiz_survey_id = quiz_data.get('survey_id')
                        course.quiz_pass_score = quiz_data.get('pass_score', 60)
                    else:
                        course.quiz_survey_id = None
                        course.quiz_pass_score = None
                elif field == 'tags':
                    course.tags = json.dumps(updates[field], ensure_ascii=False)
                elif field == 'prerequisites':
                    course.prerequisites = json.dumps(updates[field], ensure_ascii=False)
                elif field == 'isLocked':
                    # isLocked is not a database field - skip it
                    pass
                else:
                    setattr(course, field, updates[field])

        course.updated_at = datetime.utcnow()
        db.session.commit()

        return course.to_dict()

    def delete_course(self, course_id: str) -> bool:
        """
        删除课程

        Args:
            course_id: 课程 ID

        Returns:
            是否删除成功
        """
        course = db.session.get(Course, course_id)
        if not course:
            return False

        # 删除课程目录
        course_dir = os.path.join(self.courses_dir, course_id)
        if os.path.exists(course_dir):
            shutil.rmtree(course_dir)

        # 从数据库删除
        db.session.delete(course)
        db.session.commit()

        return True

    def reorder_courses(self, course_ids: list) -> bool:
        """
        重新排序课程

        Args:
            course_ids: 课程 ID 列表 (按新顺序排列)

        Returns:
            是否成功
        """
        # 获取所有课程
        courses = Course.query.all()
        course_map = {c.id: c for c in courses}

        # 按新顺序更新
        for order, course_id in enumerate(course_ids, 1):
            if course_id in course_map:
                course_map[course_id].order = order

        db.session.commit()
        return True

    def link_quiz(self, course_id: str, survey_id: str, pass_score: int = 60) -> dict:
        """
        关联考卷到课程

        Args:
            course_id: 课程 ID
            survey_id: 考卷(Survey) ID
            pass_score: 及格分数

        Returns:
            更新后的课程
        """
        return self.update_course(course_id, {
            'quiz': {
                'survey_id': survey_id,
                'pass_score': pass_score
            }
        })


course_service = CourseService()
