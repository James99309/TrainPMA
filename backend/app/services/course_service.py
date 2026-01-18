"""课程管理服务"""
import os
import json
import uuid
import shutil
from datetime import datetime
from io import BytesIO
from PyPDF2 import PdfReader


class CourseService:
    """课程管理服务"""

    def __init__(self):
        # 课程目录路径
        self.courses_dir = os.getenv('COURSES_DIR', '/app/courses')
        self.courses_json_path = os.path.join(self.courses_dir, 'courses.json')

        # 确保目录存在
        os.makedirs(self.courses_dir, exist_ok=True)

    def _load_courses(self) -> dict:
        """加载课程列表"""
        if os.path.exists(self.courses_json_path):
            with open(self.courses_json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'courses': []}

    def _save_courses(self, data: dict):
        """保存课程列表"""
        with open(self.courses_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

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
        data = self._load_courses()
        courses = data.get('courses', [])
        # 标准化每个课程数据
        return [self._normalize_course(course) for course in courses]

    def get_course(self, course_id: str) -> dict:
        """获取单个课程"""
        courses = self.get_all_courses()
        for course in courses:
            if course.get('id') == course_id:
                return course
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
        courses = self.get_all_courses()
        next_order = max([c.get('order', 0) for c in courses], default=0) + 1

        # 创建课程数据
        course = {
            'id': course_id,
            'title': title,
            'description': description,
            'type': 'pdf',
            'mediaUrl': f'/api/courses/{course_id}/content.pdf',
            'thumbnailUrl': f'/courses/{course_id}/thumbnail.png',
            'totalPages': total_pages,
            'duration_minutes': duration_minutes,
            'order': next_order,
            'tags': tags or [],
            'prerequisites': prerequisites or [],
            'is_published': True,
            'icon': icon,
            'created_at': datetime.now().isoformat()
        }

        # 添加考卷信息
        if quiz_survey_id:
            course['quiz'] = {
                'survey_id': quiz_survey_id,
                'pass_score': pass_score
            }

        # 保存到列表
        data = self._load_courses()
        data['courses'].append(course)
        self._save_courses(data)

        return course

    def update_course(self, course_id: str, updates: dict) -> dict:
        """
        更新课程信息

        Args:
            course_id: 课程 ID
            updates: 要更新的字段

        Returns:
            更新后的课程信息
        """
        data = self._load_courses()
        courses = data.get('courses', [])

        for i, course in enumerate(courses):
            if course.get('id') == course_id:
                # 允许更新的字段
                allowed_fields = ['title', 'description', 'order', 'quiz', 'isLocked',
                                  'tags', 'prerequisites', 'is_published', 'icon']
                for field in allowed_fields:
                    if field in updates:
                        course[field] = updates[field]

                course['updated_at'] = datetime.now().isoformat()
                data['courses'][i] = course
                self._save_courses(data)
                return course

        return None

    def delete_course(self, course_id: str) -> bool:
        """
        删除课程

        Args:
            course_id: 课程 ID

        Returns:
            是否删除成功
        """
        data = self._load_courses()
        courses = data.get('courses', [])

        # 查找并删除
        for i, course in enumerate(courses):
            if course.get('id') == course_id:
                # 删除课程目录
                course_dir = os.path.join(self.courses_dir, course_id)
                if os.path.exists(course_dir):
                    shutil.rmtree(course_dir)

                # 从列表中移除
                del courses[i]
                data['courses'] = courses
                self._save_courses(data)
                return True

        return False

    def reorder_courses(self, course_ids: list) -> bool:
        """
        重新排序课程

        Args:
            course_ids: 课程 ID 列表 (按新顺序排列)

        Returns:
            是否成功
        """
        data = self._load_courses()
        courses = data.get('courses', [])

        # 创建 ID -> 课程的映射
        course_map = {c['id']: c for c in courses}

        # 按新顺序更新
        for order, course_id in enumerate(course_ids, 1):
            if course_id in course_map:
                course_map[course_id]['order'] = order

        # 按 order 排序
        data['courses'] = sorted(courses, key=lambda x: x.get('order', 999))
        self._save_courses(data)
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
