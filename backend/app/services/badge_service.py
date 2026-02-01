"""
课程徽章服务
管理课程徽章的发放、更新和查询
"""
from datetime import datetime
import uuid
import threading

from app.models.base import db
from app.models.course_badge import CourseBadge


class BadgeService:
    """徽章管理服务 - 管理课程徽章"""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(BadgeService, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        try:
            self._initialized = True
            print("✅ BadgeService 初始化成功")
        except Exception as e:
            print(f"❌ BadgeService 初始化失败: {str(e)}")
            raise

    def _get_user_name(self, user_id: str) -> str:
        """获取用户名"""
        try:
            if user_id.startswith('emp_'):
                # 员工用户
                from app.services.pma_api_service import get_employee_by_id
                emp_id = user_id[4:]  # 去掉 emp_ 前缀
                emp = get_employee_by_id(emp_id)
                if emp:
                    return emp.get('name', '未知用户')
            else:
                # 客人用户
                from app.services.sheets_service import sheets_service
                user = sheets_service.get_user_by_id(user_id)
                if user:
                    return user.get('name', '未知用户')
        except Exception:
            pass
        return '未知用户'

    def _get_badge_by_user_course(self, user_id: str, course_id: str) -> dict | None:
        """根据用户ID和课程ID获取徽章"""
        try:
            badge = CourseBadge.query.filter_by(
                user_id=user_id,
                course_id=course_id
            ).first()

            if badge:
                return badge.to_dict()
            return None

        except Exception as e:
            print(f"❌ 获取徽章失败: {str(e)}")
            return None

    def issue_or_update_badge(
        self,
        user_id: str,
        course_id: str,
        course_title: str,
        survey_id: str,
        score: int,
        max_score: int,
        percentage: float
    ) -> dict:
        """
        发放或更新课程徽章

        Args:
            user_id: 用户ID
            course_id: 课程ID
            course_title: 课程名称
            survey_id: 测验ID
            score: 得分
            max_score: 满分
            percentage: 百分比

        Returns:
            {
                'success': True,
                'badge': {...},
                'is_new': True/False,
                'score_updated': True/False
            }
        """
        try:
            now = datetime.now()
            user_name = self._get_user_name(user_id)

            # 检查是否已有徽章
            existing = self._get_badge_by_user_course(user_id, course_id)

            if existing:
                # 更新徽章
                badge_obj = CourseBadge.query.filter_by(
                    user_id=user_id,
                    course_id=course_id
                ).first()

                old_score = existing.get('score', 0)
                old_attempt = existing.get('attempt_count', 0)
                new_attempt = old_attempt + 1

                score_updated = False

                # 只有新分数更高时才更新成绩
                if score > old_score:
                    # 更新分数和尝试次数
                    badge_obj.score = score
                    badge_obj.max_score = max_score
                    badge_obj.percentage = int(percentage)
                    badge_obj.attempt_count = new_attempt
                    badge_obj.last_updated_at = now
                    score_updated = True
                    print(f"🏅 更新徽章分数: {user_id} - {course_title}: {old_score} -> {score}")
                else:
                    # 只更新尝试次数
                    badge_obj.attempt_count = new_attempt
                    badge_obj.last_updated_at = now
                    print(f"🏅 更新徽章尝试次数: {user_id} - {course_title}: 第 {new_attempt} 次 (分数保持 {old_score})")

                db.session.commit()

                # 返回更新后的徽章
                badge = badge_obj.to_dict()

                return {
                    'success': True,
                    'badge': badge,
                    'is_new': False,
                    'score_updated': score_updated
                }

            else:
                # 创建新徽章
                badge_id = f"badge-{uuid.uuid4().hex[:8]}"

                badge_obj = CourseBadge(
                    badge_id=badge_id,
                    user_id=user_id,
                    user_name=user_name,
                    course_id=course_id,
                    course_title=course_title,
                    survey_id=survey_id,
                    score=score,
                    max_score=max_score,
                    percentage=int(percentage),
                    attempt_count=1,
                    first_passed_at=now,
                    last_updated_at=now
                )

                db.session.add(badge_obj)
                db.session.commit()

                badge = badge_obj.to_dict()
                print(f"🏅 发放新徽章: {user_id} - {course_title}: {score}/{max_score}")

                return {
                    'success': True,
                    'badge': badge,
                    'is_new': True,
                    'score_updated': True
                }

        except Exception as e:
            db.session.rollback()
            print(f"❌ 发放/更新徽章失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'message': str(e)}

    def get_user_badges(self, user_id: str) -> list:
        """
        获取用户的所有徽章

        Args:
            user_id: 用户ID

        Returns:
            徽章列表
        """
        try:
            badges = CourseBadge.query.filter_by(
                user_id=user_id
            ).order_by(
                CourseBadge.first_passed_at.desc()
            ).all()

            return [badge.to_dict() for badge in badges]

        except Exception as e:
            print(f"❌ 获取用户徽章失败: {str(e)}")
            return []

    def get_badge_by_id(self, badge_id: str) -> dict | None:
        """
        获取单个徽章详情

        Args:
            badge_id: 徽章ID

        Returns:
            徽章详情，不存在返回 None
        """
        try:
            badge = db.session.get(CourseBadge, badge_id)

            if badge:
                return badge.to_dict()
            return None

        except Exception as e:
            print(f"❌ 获取徽章详情失败: {str(e)}")
            return None

    def get_course_by_survey_id(self, survey_id: str) -> dict | None:
        """
        根据测验ID获取课程信息

        Args:
            survey_id: 测验ID

        Returns:
            {'course_id': ..., 'course_title': ...} 或 None
        """
        try:
            from app.services.course_service import course_service

            courses = course_service.get_all_courses()
            for course in courses:
                quiz = course.get('quiz')
                if quiz and quiz.get('survey_id') == survey_id:
                    return {
                        'course_id': course.get('id'),
                        'course_title': course.get('title', '未知课程')
                    }

            return None

        except Exception as e:
            print(f"❌ 根据测验ID获取课程失败: {str(e)}")
            return None


# 单例实例 - 延迟初始化
_badge_service = None
_badge_service_init_error = None


def get_badge_service():
    """获取 BadgeService 实例（延迟初始化）"""
    global _badge_service, _badge_service_init_error

    if _badge_service is not None:
        return _badge_service

    if _badge_service_init_error is not None:
        # 已经尝试过初始化但失败了，抛出保存的错误
        raise _badge_service_init_error

    try:
        _badge_service = BadgeService()
        return _badge_service
    except Exception as e:
        _badge_service_init_error = e
        raise


# 为了向后兼容，提供一个属性访问器
# 注意：直接使用 badge_service 会在首次访问时初始化
class _BadgeServiceProxy:
    """代理类，实现延迟初始化的向后兼容"""
    def __getattr__(self, name):
        return getattr(get_badge_service(), name)


badge_service = _BadgeServiceProxy()
