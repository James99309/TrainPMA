"""
课程徽章服务
管理课程徽章的发放、更新和查询
"""
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import uuid
import json
import os
import threading


class BadgeService:
    """徽章管理服务 - 管理 CourseBadges Sheet"""

    _instance = None
    _lock = threading.Lock()

    # CourseBadges Sheet 列结构
    COLUMNS = [
        'badge_id',
        'user_id',
        'user_name',
        'course_id',
        'course_title',
        'survey_id',
        'score',
        'max_score',
        'percentage',
        'attempt_count',
        'first_passed_at',
        'last_updated_at'
    ]

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
            scope = [
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive'
            ]

            creds_file = os.getenv('GOOGLE_CREDENTIALS_FILE', 'credentials/service-account.json')
            creds = ServiceAccountCredentials.from_json_keyfile_name(creds_file, scope)
            self.client = gspread.authorize(creds)

            sheets_id = os.getenv('GOOGLE_SHEETS_ID')
            self.spreadsheet = self.client.open_by_key(sheets_id)

            # 获取或创建 CourseBadges sheet
            self._ensure_badges_sheet()

            self._initialized = True
            print("✅ BadgeService 初始化成功")
        except Exception as e:
            print(f"❌ BadgeService 初始化失败: {str(e)}")
            raise

    def _ensure_badges_sheet(self):
        """确保 CourseBadges sheet 存在且表头完整"""
        try:
            self.badges_sheet = self.spreadsheet.worksheet('CourseBadges')
            print("✅ CourseBadges sheet 已存在")

            # 检查并修复表头
            self._fix_headers_if_needed()

        except gspread.exceptions.WorksheetNotFound:
            print("⚠️ CourseBadges sheet 不存在，正在创建...")
            self.badges_sheet = self.spreadsheet.add_worksheet(
                title='CourseBadges',
                rows=1000,
                cols=len(self.COLUMNS)
            )
            # 添加表头
            self.badges_sheet.append_row(self.COLUMNS)
            print("✅ CourseBadges sheet 创建成功")

    def _fix_headers_if_needed(self):
        """检查并修复缺失的表头"""
        try:
            current_headers = self.badges_sheet.row_values(1)
            expected_headers = self.COLUMNS

            if current_headers == expected_headers:
                print("✅ 徽章表头完整")
                return

            print(f"⚠️ 徽章表头不完整，当前 {len(current_headers)} 列，期望 {len(expected_headers)} 列")

            # 直接覆盖第一行为正确的表头
            self.badges_sheet.update('A1', [expected_headers])
            print("✅ 徽章表头已修复")

        except Exception as e:
            print(f"❌ 检查/修复徽章表头失败: {str(e)}")

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
            all_values = self.badges_sheet.get_all_values()
            if len(all_values) <= 1:
                return None

            headers = all_values[0]
            user_id_col = headers.index('user_id') if 'user_id' in headers else 1
            course_id_col = headers.index('course_id') if 'course_id' in headers else 3

            for idx, row in enumerate(all_values[1:], start=2):  # idx 是 Excel 行号
                if (len(row) > max(user_id_col, course_id_col) and
                    row[user_id_col] == user_id and
                    row[course_id_col] == course_id):
                    badge = self._row_to_badge(row, headers)
                    badge['_row_index'] = idx  # 保存行索引用于更新
                    return badge

            return None

        except Exception as e:
            print(f"❌ 获取徽章失败: {str(e)}")
            return None

    def _row_to_badge(self, row: list, headers: list) -> dict:
        """将行数据转换为徽章字典"""
        badge = {}
        for i, header in enumerate(headers):
            value = row[i] if i < len(row) else ''

            # 数值字段
            if header in ['score', 'max_score', 'percentage', 'attempt_count']:
                try:
                    badge[header] = int(value) if value else 0
                except:
                    badge[header] = 0
            else:
                badge[header] = value

        return badge

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
            now = datetime.now().isoformat()
            user_name = self._get_user_name(user_id)

            # 检查是否已有徽章
            existing = self._get_badge_by_user_course(user_id, course_id)

            if existing:
                # 更新徽章
                row_index = existing.get('_row_index')
                old_score = existing.get('score', 0)
                old_attempt = existing.get('attempt_count', 0)
                new_attempt = old_attempt + 1

                score_updated = False

                # 只有新分数更高时才更新成绩
                if score > old_score:
                    # 更新分数和尝试次数
                    updates = {
                        'score': score,
                        'max_score': max_score,
                        'percentage': int(percentage),
                        'attempt_count': new_attempt,
                        'last_updated_at': now
                    }
                    score_updated = True
                    print(f"🏅 更新徽章分数: {user_id} - {course_title}: {old_score} -> {score}")
                else:
                    # 只更新尝试次数
                    updates = {
                        'attempt_count': new_attempt,
                        'last_updated_at': now
                    }
                    print(f"🏅 更新徽章尝试次数: {user_id} - {course_title}: 第 {new_attempt} 次 (分数保持 {old_score})")

                self._update_badge_row(row_index, updates)

                # 返回更新后的徽章
                badge = existing.copy()
                del badge['_row_index']
                if score_updated:
                    badge['score'] = score
                    badge['max_score'] = max_score
                    badge['percentage'] = int(percentage)
                badge['attempt_count'] = new_attempt
                badge['last_updated_at'] = now

                return {
                    'success': True,
                    'badge': badge,
                    'is_new': False,
                    'score_updated': score_updated
                }

            else:
                # 创建新徽章
                badge_id = f"badge-{uuid.uuid4().hex[:8]}"

                badge = {
                    'badge_id': badge_id,
                    'user_id': user_id,
                    'user_name': user_name,
                    'course_id': course_id,
                    'course_title': course_title,
                    'survey_id': survey_id,
                    'score': score,
                    'max_score': max_score,
                    'percentage': int(percentage),
                    'attempt_count': 1,
                    'first_passed_at': now,
                    'last_updated_at': now
                }

                self._save_badge(badge)
                print(f"🏅 发放新徽章: {user_id} - {course_title}: {score}/{max_score}")

                return {
                    'success': True,
                    'badge': badge,
                    'is_new': True,
                    'score_updated': True
                }

        except Exception as e:
            print(f"❌ 发放/更新徽章失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'message': str(e)}

    def _save_badge(self, badge: dict):
        """保存徽章到 Sheet"""
        row = [
            badge.get('badge_id', ''),
            badge.get('user_id', ''),
            badge.get('user_name', ''),
            badge.get('course_id', ''),
            badge.get('course_title', ''),
            badge.get('survey_id', ''),
            badge.get('score', 0),
            badge.get('max_score', 0),
            badge.get('percentage', 0),
            badge.get('attempt_count', 1),
            badge.get('first_passed_at', ''),
            badge.get('last_updated_at', '')
        ]
        self.badges_sheet.append_row(row)

    def _update_badge_row(self, row_index: int, updates: dict):
        """更新徽章行"""
        headers = self.badges_sheet.row_values(1)

        for field, value in updates.items():
            if field in headers:
                col_index = headers.index(field) + 1  # gspread 列索引从1开始
                self.badges_sheet.update_cell(row_index, col_index, value)

    def get_user_badges(self, user_id: str) -> list:
        """
        获取用户的所有徽章

        Args:
            user_id: 用户ID

        Returns:
            徽章列表
        """
        try:
            all_values = self.badges_sheet.get_all_values()
            if len(all_values) <= 1:
                return []

            headers = all_values[0]
            user_id_col = headers.index('user_id') if 'user_id' in headers else 1

            badges = []
            for row in all_values[1:]:
                if len(row) > user_id_col and row[user_id_col] == user_id:
                    badge = self._row_to_badge(row, headers)
                    badges.append(badge)

            # 按首次通过时间倒序
            badges.sort(key=lambda x: x.get('first_passed_at', ''), reverse=True)
            return badges

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
            all_values = self.badges_sheet.get_all_values()
            if len(all_values) <= 1:
                return None

            headers = all_values[0]
            badge_id_col = headers.index('badge_id') if 'badge_id' in headers else 0

            for row in all_values[1:]:
                if len(row) > badge_id_col and row[badge_id_col] == badge_id:
                    return self._row_to_badge(row, headers)

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
