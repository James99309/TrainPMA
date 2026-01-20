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
        # 课程表 XP 统计
        'xp_by_syllabus',          # JSON object - {"syllabus-001": 150, "syllabus-002": 80}
        # 首次登录奖励
        'first_login_reward_claimed',  # bool - 是否已领取首次登录奖励
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

        try:
            xp_by_syllabus = json.loads(row.get('xp_by_syllabus', '{}') or '{}')
        except:
            xp_by_syllabus = {}

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
            # 课程表 XP 统计
            'xpBySyllabus': xp_by_syllabus,
            # 首次登录奖励
            'firstLoginRewardClaimed': str(row.get('first_login_reward_claimed', 'FALSE')).upper() == 'TRUE',
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
            # 课程表 XP 统计
            json.dumps(progress.get('xpBySyllabus', {}), ensure_ascii=False),
            # 首次登录奖励
            'TRUE' if progress.get('firstLoginRewardClaimed', False) else 'FALSE',
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
            # 课程表 XP 统计
            'xpBySyllabus': {},
            # 首次登录奖励
            'firstLoginRewardClaimed': False,
        }


    def add_syllabus_xp(self, user_id: str, syllabus_id: str, xp: int) -> bool:
        """
        为用户在特定课程表增加XP
        注意: 这个 XP 只记录在 xp_by_syllabus 中，不增加到 totalXP
        因为课程表 XP 与账户总 XP 是独立的

        Args:
            user_id: 用户ID
            syllabus_id: 课程表ID
            xp: 要增加的XP

        Returns:
            是否添加成功
        """
        try:
            progress = self.get_user_progress(user_id)
            if not progress:
                progress = self.get_default_progress()

            xp_by_syllabus = progress.get('xpBySyllabus', {})
            current_xp = xp_by_syllabus.get(syllabus_id, 0)
            xp_by_syllabus[syllabus_id] = current_xp + xp
            progress['xpBySyllabus'] = xp_by_syllabus

            return self.save_user_progress(user_id, progress)
        except Exception as e:
            print(f"❌ 添加课程表XP失败: {str(e)}")
            return False

    def _get_all_user_progress(self) -> list:
        """获取所有用户的进度数据"""
        try:
            all_values = self.progress_sheet.get_all_values()
            if not all_values or len(all_values) <= 1:
                return []

            headers = all_values[0]
            progress_list = []

            for row in all_values[1:]:
                row_dict = {}
                for i, header in enumerate(headers):
                    row_dict[header] = row[i] if i < len(row) else ''
                progress = self._row_to_progress(row_dict)
                progress['user_id'] = row_dict.get('user_id', '')
                if progress['user_id']:
                    progress_list.append(progress)

            return progress_list
        except Exception as e:
            print(f"❌ 获取所有用户进度失败: {str(e)}")
            return []

    def _get_user_map(self) -> dict:
        """获取用户ID到用户名的映射"""
        from app.services.sheets_service import sheets_service

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
                emp_name = emp.get('name') or emp.get('real_name') or '未知'
                user_map[emp.get('user_id')] = emp_name
        except Exception:
            pass

        return user_map

    def _build_leaderboard_entry(self, progress: dict, rank: int, user_map: dict) -> dict:
        """构建排行榜条目"""
        user_id = progress.get('user_id', '')
        total_xp = progress.get('totalXP', 0)
        level = total_xp // 100 + 1
        username = user_map.get(user_id, user_id)

        return {
            'rank': rank,
            'user_id': user_id,
            'username': username,
            'totalXP': total_xp,
            'level': level
        }

    def _get_user_rank_info(self, user_id: str, progress_list: list = None) -> dict:
        """获取用户的排名信息"""
        if progress_list is None:
            progress_list = self._get_all_user_progress()

        # 按 XP 降序排序
        sorted_list = sorted(progress_list, key=lambda x: x.get('totalXP', 0), reverse=True)

        # 查找用户排名
        user_progress = None
        user_rank = None
        for idx, p in enumerate(sorted_list, 1):
            if p.get('user_id') == user_id:
                user_progress = p
                user_rank = idx
                break

        if user_progress:
            return {
                'rank': user_rank,
                'totalXP': user_progress.get('totalXP', 0),
                'level': user_progress.get('totalXP', 0) // 100 + 1
            }
        else:
            return {
                'rank': None,
                'totalXP': 0,
                'level': 1
            }

    def _get_guest_leaderboard(self, user_id: str, limit: int) -> dict:
        """客人排行榜 - 按组分别显示"""
        from app.services.user_group_service import user_group_service

        # 获取用户所属的所有组
        user_groups = user_group_service.get_user_groups_for_user(user_id)

        if not user_groups:
            # 不在任何组，只返回自己
            return {
                'type': 'self_only',
                'current_user': self._get_user_rank_info(user_id)
            }

        # 获取所有进度和用户映射
        all_progress = self._get_all_user_progress()
        user_map = self._get_user_map()
        progress_map = {p['user_id']: p for p in all_progress}

        # 为每个组生成排行榜
        groups_data = []
        for group in user_groups:
            member_ids = group.get('member_ids', [])

            # 获取组内成员的进度
            group_progress = []
            for member_id in member_ids:
                if member_id in progress_map:
                    group_progress.append(progress_map[member_id])
                else:
                    # 成员没有进度记录，使用默认值
                    group_progress.append({
                        'user_id': member_id,
                        'totalXP': 0,
                        'level': 1
                    })

            # 按 XP 降序排序
            group_progress.sort(key=lambda x: x.get('totalXP', 0), reverse=True)

            # 构建排行榜
            leaderboard = []
            for idx, p in enumerate(group_progress[:limit], 1):
                leaderboard.append(self._build_leaderboard_entry(p, idx, user_map))

            groups_data.append({
                'group_id': group['id'],
                'group_name': group['name'],
                'leaderboard': leaderboard
            })

        return {
            'type': 'groups',
            'groups': groups_data,
            'current_user': self._get_user_rank_info(user_id, all_progress)
        }

    def _get_employee_leaderboard(self, user_id: str, limit: int) -> dict:
        """员工排行榜 - 仅员工"""
        all_progress = self._get_all_user_progress()

        # 过滤 emp_ 前缀的用户
        employee_progress = [p for p in all_progress if p.get('user_id', '').startswith('emp_')]

        # 按 XP 降序排序
        employee_progress.sort(key=lambda x: x.get('totalXP', 0), reverse=True)

        # 获取用户映射
        user_map = self._get_user_map()

        # 构建排行榜
        leaderboard = []
        for idx, p in enumerate(employee_progress[:limit], 1):
            leaderboard.append(self._build_leaderboard_entry(p, idx, user_map))

        return {
            'type': 'employees',
            'leaderboard': leaderboard,
            'current_user': self._get_user_rank_info(user_id, employee_progress)
        }

    def _get_syllabus_leaderboard(self, syllabus_id: str, user_id: str, limit: int) -> dict:
        """课程表排行榜 - 按课程表内累计XP排序，员工客人混合"""
        all_progress = self._get_all_user_progress()

        # 过滤有该课程表XP的用户
        syllabus_progress = []
        for p in all_progress:
            xp_by_syllabus = p.get('xpBySyllabus', {})
            syllabus_xp = xp_by_syllabus.get(syllabus_id, 0)
            if syllabus_xp > 0:
                syllabus_progress.append({
                    **p,
                    'syllabusXP': syllabus_xp
                })

        # 按 syllabusXP 排序
        syllabus_progress.sort(key=lambda x: x.get('syllabusXP', 0), reverse=True)

        # 获取用户映射
        user_map = self._get_user_map()

        # 构建排行榜
        leaderboard = []
        for idx, p in enumerate(syllabus_progress[:limit], 1):
            entry = self._build_leaderboard_entry(p, idx, user_map)
            entry['syllabusXP'] = p.get('syllabusXP', 0)
            leaderboard.append(entry)

        # 获取课程表名称
        from app.services.syllabus_service import syllabus_service
        syllabus = syllabus_service.get_syllabus(syllabus_id)
        syllabus_name = syllabus.get('name', '未知课程表') if syllabus else '未知课程表'

        # 获取当前用户的课程表排名信息
        current_user_info = {
            'rank': None,
            'totalXP': 0,
            'syllabusXP': 0,
            'level': 1
        }
        for idx, p in enumerate(syllabus_progress, 1):
            if p.get('user_id') == user_id:
                current_user_info = {
                    'rank': idx,
                    'totalXP': p.get('totalXP', 0),
                    'syllabusXP': p.get('syllabusXP', 0),
                    'level': p.get('totalXP', 0) // 100 + 1
                }
                break

        return {
            'type': 'syllabus',
            'syllabus_id': syllabus_id,
            'syllabus_name': syllabus_name,
            'leaderboard': leaderboard,
            'current_user': current_user_info
        }

    def get_leaderboard(
        self,
        user_id: str,
        user_type: str,
        leaderboard_type: str = 'auto',
        syllabus_id: str = None,
        limit: int = 50
    ) -> dict:
        """
        根据用户类型和请求类型返回不同的排行榜

        Args:
            user_id: 用户ID
            user_type: 用户类型 ('guest' | 'employee')
            leaderboard_type: 排行榜类型 ('auto' | 'syllabus')
            syllabus_id: 课程表ID (当 leaderboard_type='syllabus' 时必填)
            limit: 返回的最大用户数

        Returns:
            排行榜数据
        """
        try:
            if leaderboard_type == 'syllabus' and syllabus_id:
                return self._get_syllabus_leaderboard(syllabus_id, user_id, limit)

            if user_type == 'employee':
                return self._get_employee_leaderboard(user_id, limit)

            # guest
            return self._get_guest_leaderboard(user_id, limit)

        except Exception as e:
            print(f"❌ 获取排行榜失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'self_only',
                'current_user': {'rank': None, 'totalXP': 0, 'level': 1}
            }


# 单例实例
progress_service = ProgressService()
