"""
用户进度服务
存储和同步用户学习进度到 Google Sheets
"""
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import uuid
import json
import os
import threading


class ProgressService:
    """用户进度服务 - 管理 UserProgress Sheet"""

    _instance = None
    _lock = threading.Lock()

    # UserProgress Sheet 列结构
    COLUMNS = [
        'progress_id',
        'user_id',
        'streak',
        'total_xp',
        'hearts',
        'max_hearts',
        'daily_goal_minutes',
        'current_chapter',
        'current_section',
        'chapters_completed',      # JSON array
        'achievements',            # JSON array
        'words_learned',           # JSON array
        'total_reading_time',
        'onboarding_completed',
        'last_read_date',
        # 培训系统新增字段
        'courses_completed',       # JSON array - 完成的课程ID列表
        'quizzes_passed',          # int - 通过的测验次数
        'quiz_streak',             # int - 连续通过测验次数
        # XP 奖励系统字段
        'last_login_reward_date',  # 上次领取登录奖励日期
        'first_passed_quizzes',    # JSON array - 首次通过的测验ID列表
        # 错题记录
        'wrong_questions',         # JSON array - 错题记录
        'updated_at'
    ]

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(ProgressService, cls).__new__(cls)
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

            # 获取或创建 UserProgress sheet
            self._ensure_progress_sheet()

            self._initialized = True
            print("✅ ProgressService 初始化成功")
        except Exception as e:
            print(f"❌ ProgressService 初始化失败: {str(e)}")
            raise

    def _ensure_progress_sheet(self):
        """确保 UserProgress sheet 存在且表头完整"""
        try:
            self.progress_sheet = self.spreadsheet.worksheet('UserProgress')
            print("✅ UserProgress sheet 已存在")

            # 检查并修复表头
            self._fix_headers_if_needed()

        except gspread.exceptions.WorksheetNotFound:
            print("⚠️ UserProgress sheet 不存在，正在创建...")
            self.progress_sheet = self.spreadsheet.add_worksheet(
                title='UserProgress',
                rows=1000,
                cols=len(self.COLUMNS)
            )
            # 添加表头
            self.progress_sheet.append_row(self.COLUMNS)
            print("✅ UserProgress sheet 创建成功")

    def _fix_headers_if_needed(self):
        """检查并修复缺失的表头"""
        try:
            current_headers = self.progress_sheet.row_values(1)
            expected_headers = self.COLUMNS

            if current_headers == expected_headers:
                print("✅ 表头完整")
                return

            print(f"⚠️ 表头不完整，当前 {len(current_headers)} 列，期望 {len(expected_headers)} 列")
            print(f"   当前表头: {current_headers}")
            print(f"   期望表头: {expected_headers}")

            # 直接覆盖第一行为正确的表头
            self.progress_sheet.update('A1', [expected_headers])
            print("✅ 表头已修复")

        except Exception as e:
            print(f"❌ 检查/修复表头失败: {str(e)}")
            import traceback
            traceback.print_exc()

    def get_user_progress(self, user_id: str) -> dict | None:
        """
        获取用户进度

        Args:
            user_id: 用户ID (phone 或 emp_{id})

        Returns:
            用户进度数据字典，如不存在返回 None
        """
        try:
            # 使用 get_all_values 代替 get_all_records 避免表头问题
            all_values = self.progress_sheet.get_all_values()
            if len(all_values) <= 1:
                # 只有表头或空表
                return None

            headers = all_values[0]
            user_id_col = headers.index('user_id') if 'user_id' in headers else 1

            for row in all_values[1:]:  # 跳过表头
                if len(row) > user_id_col and row[user_id_col] == user_id:
                    # 将行数据转换为字典
                    row_dict = {}
                    for i, header in enumerate(headers):
                        row_dict[header] = row[i] if i < len(row) else ''
                    return self._row_to_progress(row_dict)
            return None
        except Exception as e:
            print(f"❌ 获取用户进度失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def save_user_progress(self, user_id: str, progress: dict) -> bool:
        """
        保存用户进度 (新增或更新)

        Args:
            user_id: 用户ID
            progress: 进度数据

        Returns:
            是否保存成功
        """
        try:
            rows = self.progress_sheet.get_all_values()
            now = datetime.now().isoformat()

            # 查找现有记录
            for idx, row in enumerate(rows):
                if idx == 0:  # 跳过表头
                    continue
                if len(row) > 1 and row[1] == user_id:
                    # 更新现有记录
                    updated_row = self._progress_to_row(progress, row[0], user_id, now)
                    self.progress_sheet.update(f'A{idx + 1}:{chr(65 + len(self.COLUMNS) - 1)}{idx + 1}', [updated_row])
                    print(f"✅ 更新用户进度: {user_id}")
                    return True

            # 新增记录
            progress_id = str(uuid.uuid4())
            new_row = self._progress_to_row(progress, progress_id, user_id, now)
            self.progress_sheet.append_row(new_row)
            print(f"✅ 创建用户进度: {user_id}")
            return True

        except Exception as e:
            print(f"❌ 保存用户进度失败: {str(e)}")
            return False

    def _row_to_progress(self, row: dict) -> dict:
        """将 Sheet 行数据转换为进度字典"""
        try:
            chapters_completed = json.loads(row.get('chapters_completed', '[]') or '[]')
        except:
            chapters_completed = []

        try:
            achievements = json.loads(row.get('achievements', '[]') or '[]')
        except:
            achievements = []

        try:
            words_learned = json.loads(row.get('words_learned', '[]') or '[]')
        except:
            words_learned = []

        try:
            courses_completed = json.loads(row.get('courses_completed', '[]') or '[]')
        except:
            courses_completed = []

        try:
            first_passed_quizzes = json.loads(row.get('first_passed_quizzes', '[]') or '[]')
        except:
            first_passed_quizzes = []

        try:
            wrong_questions = json.loads(row.get('wrong_questions', '[]') or '[]')
        except:
            wrong_questions = []

        return {
            'streak': int(row.get('streak', 0) or 0),
            'lastReadDate': row.get('last_read_date') or None,
            'totalXP': int(row.get('total_xp', 0) or 0),
            'hearts': int(row.get('hearts', 5) or 5),
            'maxHearts': int(row.get('max_hearts', 5) or 5),
            'dailyGoalMinutes': int(row.get('daily_goal_minutes', 10) or 10),
            'currentChapter': int(row.get('current_chapter', 1) or 1),
            'currentSection': int(row.get('current_section', 0) or 0),
            'chaptersCompleted': chapters_completed,
            'achievements': achievements,
            'wordsLearned': words_learned,
            'totalReadingTime': int(row.get('total_reading_time', 0) or 0),
            'onboardingCompleted': str(row.get('onboarding_completed', 'FALSE')).upper() == 'TRUE',
            # 培训系统新增字段
            'coursesCompleted': courses_completed,
            'quizzesPassed': int(row.get('quizzes_passed', 0) or 0),
            'quizStreak': int(row.get('quiz_streak', 0) or 0),
            # XP 奖励系统字段
            'lastLoginRewardDate': row.get('last_login_reward_date') or None,
            'firstPassedQuizzes': first_passed_quizzes,
            # 错题记录
            'wrongQuestions': wrong_questions,
        }

    def _progress_to_row(self, progress: dict, progress_id: str, user_id: str, updated_at: str) -> list:
        """将进度字典转换为 Sheet 行数据"""
        return [
            progress_id,
            user_id,
            progress.get('streak', 0),
            progress.get('totalXP', 0),
            progress.get('hearts', 5),
            progress.get('maxHearts', 5),
            progress.get('dailyGoalMinutes', 10),
            progress.get('currentChapter', 1),
            progress.get('currentSection', 0),
            json.dumps(progress.get('chaptersCompleted', []), ensure_ascii=False),
            json.dumps(progress.get('achievements', []), ensure_ascii=False),
            json.dumps(progress.get('wordsLearned', []), ensure_ascii=False),
            progress.get('totalReadingTime', 0),
            'TRUE' if progress.get('onboardingCompleted', False) else 'FALSE',
            progress.get('lastReadDate') or '',
            # 培训系统新增字段
            json.dumps(progress.get('coursesCompleted', []), ensure_ascii=False),
            progress.get('quizzesPassed', 0),
            progress.get('quizStreak', 0),
            # XP 奖励系统字段
            progress.get('lastLoginRewardDate') or '',
            json.dumps(progress.get('firstPassedQuizzes', []), ensure_ascii=False),
            # 错题记录
            json.dumps(progress.get('wrongQuestions', []), ensure_ascii=False),
            updated_at
        ]

    def get_default_progress(self) -> dict:
        """返回默认进度数据"""
        return {
            'streak': 0,
            'lastReadDate': None,
            'totalXP': 0,
            'hearts': 5,
            'maxHearts': 5,
            'dailyGoalMinutes': 10,
            'currentChapter': 1,
            'currentSection': 0,
            'chaptersCompleted': [],
            'achievements': [],
            'wordsLearned': [],
            'totalReadingTime': 0,
            'onboardingCompleted': False,
            # 培训系统新增字段
            'coursesCompleted': [],
            'quizzesPassed': 0,
            'quizStreak': 0,
            # XP 奖励系统字段
            'lastLoginRewardDate': None,
            'firstPassedQuizzes': [],
            # 错题记录
            'wrongQuestions': [],
        }


    def get_leaderboard(self, limit: int = 50) -> list:
        """
        获取全局 XP 排行榜

        Args:
            limit: 返回的最大用户数

        Returns:
            排行榜数据列表，按 XP 降序排列
        """
        try:
            from app.services.sheets_service import sheets_service

            # 获取所有用户进度
            all_values = self.progress_sheet.get_all_values()
            if len(all_values) <= 1:
                return []

            headers = all_values[0]
            user_id_col = headers.index('user_id') if 'user_id' in headers else 1
            total_xp_col = headers.index('total_xp') if 'total_xp' in headers else 3

            # 收集所有用户的 XP
            user_xp_list = []
            for row in all_values[1:]:
                if len(row) > max(user_id_col, total_xp_col):
                    user_id = row[user_id_col]
                    try:
                        total_xp = int(row[total_xp_col] or 0)
                    except (ValueError, TypeError):
                        total_xp = 0
                    if user_id:
                        user_xp_list.append({
                            'user_id': user_id,
                            'totalXP': total_xp
                        })

            # 按 XP 降序排序
            user_xp_list.sort(key=lambda x: x['totalXP'], reverse=True)

            # 获取用户名称映射（游客 + 员工）
            user_map = {}
            try:
                # 游客用户
                users = sheets_service.get_all_users(limit=500)
                for u in users:
                    user_map[u.get('user_id')] = u.get('name', '未知')
            except:
                pass

            try:
                # 员工用户
                from app.services.pma_api_service import get_all_employees
                employees = get_all_employees(limit=500)
                for emp in employees:
                    user_map[emp.get('user_id')] = emp.get('name', '未知')
            except:
                pass

            # 构建排行榜数据
            leaderboard = []
            for rank, item in enumerate(user_xp_list[:limit], 1):
                user_id = item['user_id']
                total_xp = item['totalXP']
                level = total_xp // 100 + 1

                # 获取用户名
                username = user_map.get(user_id, user_id)

                leaderboard.append({
                    'rank': rank,
                    'user_id': user_id,
                    'username': username,
                    'totalXP': total_xp,
                    'level': level
                })

            return leaderboard

        except Exception as e:
            print(f"❌ 获取排行榜失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return []


# 单例实例
progress_service = ProgressService()
