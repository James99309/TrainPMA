"""
用户进度服务 (PostgreSQL 版)
替代原 Google Sheets 数据层，保持所有方法签名和返回格式不变
"""
from datetime import datetime
import uuid
import json

from app.models.base import db
from app.models.user_progress import UserProgress


class ProgressService:
    """用户进度服务 - 使用 SQLAlchemy 替代 Google Sheets"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ProgressService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        print("✅ ProgressService (PostgreSQL) 初始化成功")

    def get_user_progress(self, user_id: str) -> dict | None:
        progress = UserProgress.query.filter_by(user_id=user_id).first()
        if not progress:
            return None
        return progress.to_dict()

    def save_user_progress(self, user_id: str, progress: dict) -> bool:
        try:
            existing = UserProgress.query.filter_by(user_id=user_id).first()
            now = datetime.now()

            if existing:
                existing.streak = progress.get('streak', 0)
                existing.total_xp = progress.get('totalXP', 0)
                existing.hearts = progress.get('hearts', 5)
                existing.max_hearts = progress.get('maxHearts', 5)
                existing.daily_goal_minutes = progress.get('dailyGoalMinutes', 10)
                existing.current_chapter = progress.get('currentChapter', 1)
                existing.current_section = progress.get('currentSection', 0)
                existing.chapters_completed = json.dumps(progress.get('chaptersCompleted', []), ensure_ascii=False)
                existing.achievements = json.dumps(progress.get('achievements', []), ensure_ascii=False)
                existing.words_learned = json.dumps(progress.get('wordsLearned', []), ensure_ascii=False)
                existing.total_reading_time = progress.get('totalReadingTime', 0)
                existing.onboarding_completed = progress.get('onboardingCompleted', False)
                existing.last_read_date = progress.get('lastReadDate') or ''
                existing.courses_completed = json.dumps(progress.get('coursesCompleted', []), ensure_ascii=False)
                existing.quizzes_passed = progress.get('quizzesPassed', 0)
                existing.quiz_streak = progress.get('quizStreak', 0)
                existing.last_login_reward_date = progress.get('lastLoginRewardDate') or ''
                existing.first_passed_quizzes = json.dumps(progress.get('firstPassedQuizzes', []), ensure_ascii=False)
                existing.wrong_questions = json.dumps(progress.get('wrongQuestions', []), ensure_ascii=False)
                existing.xp_by_syllabus = json.dumps(progress.get('xpBySyllabus', {}), ensure_ascii=False)
                existing.first_login_reward_claimed = progress.get('firstLoginRewardClaimed', False)
                existing.updated_at = now
            else:
                new_progress = UserProgress(
                    progress_id=str(uuid.uuid4()),
                    user_id=user_id,
                    streak=progress.get('streak', 0),
                    total_xp=progress.get('totalXP', 0),
                    hearts=progress.get('hearts', 5),
                    max_hearts=progress.get('maxHearts', 5),
                    daily_goal_minutes=progress.get('dailyGoalMinutes', 10),
                    current_chapter=progress.get('currentChapter', 1),
                    current_section=progress.get('currentSection', 0),
                    chapters_completed=json.dumps(progress.get('chaptersCompleted', []), ensure_ascii=False),
                    achievements=json.dumps(progress.get('achievements', []), ensure_ascii=False),
                    words_learned=json.dumps(progress.get('wordsLearned', []), ensure_ascii=False),
                    total_reading_time=progress.get('totalReadingTime', 0),
                    onboarding_completed=progress.get('onboardingCompleted', False),
                    last_read_date=progress.get('lastReadDate') or '',
                    courses_completed=json.dumps(progress.get('coursesCompleted', []), ensure_ascii=False),
                    quizzes_passed=progress.get('quizzesPassed', 0),
                    quiz_streak=progress.get('quizStreak', 0),
                    last_login_reward_date=progress.get('lastLoginRewardDate') or '',
                    first_passed_quizzes=json.dumps(progress.get('firstPassedQuizzes', []), ensure_ascii=False),
                    wrong_questions=json.dumps(progress.get('wrongQuestions', []), ensure_ascii=False),
                    xp_by_syllabus=json.dumps(progress.get('xpBySyllabus', {}), ensure_ascii=False),
                    first_login_reward_claimed=progress.get('firstLoginRewardClaimed', False),
                    updated_at=now,
                )
                db.session.add(new_progress)

            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"❌ 保存用户进度失败: {str(e)}")
            return False

    def get_default_progress(self) -> dict:
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
            'coursesCompleted': [],
            'quizzesPassed': 0,
            'quizStreak': 0,
            'lastLoginRewardDate': None,
            'firstPassedQuizzes': [],
            'wrongQuestions': [],
            'xpBySyllabus': {},
            'firstLoginRewardClaimed': False,
        }

    def add_syllabus_xp(self, user_id: str, syllabus_id: str, xp: int) -> bool:
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
        all_progress = UserProgress.query.all()
        return [p.to_dict_with_user_id() for p in all_progress]

    def _get_user_map(self) -> dict:
        """获取用户ID到用户名的映射"""
        from app.services.sheets_service import sheets_service

        user_map = {}
        try:
            users = sheets_service.get_all_users(limit=500)
            for u in users:
                user_map[u.get('user_id')] = u.get('name', '未知')
        except Exception:
            pass

        try:
            from app.services.pma_api_service import get_all_employees
            employees = get_all_employees(limit=500)
            for emp in employees:
                emp_name = emp.get('name') or emp.get('real_name') or '未知'
                user_map[emp.get('user_id')] = emp_name
        except Exception:
            pass

        return user_map

    def _build_leaderboard_entry(self, progress: dict, rank: int, user_map: dict) -> dict:
        user_id = progress.get('user_id', '')
        total_xp = progress.get('totalXP', 0)
        level = total_xp // 100 + 1
        username = user_map.get(user_id, user_id)
        return {
            'rank': rank,
            'user_id': user_id,
            'username': username,
            'totalXP': total_xp,
            'level': level,
        }

    def _get_user_rank_info(self, user_id: str, progress_list: list = None) -> dict:
        if progress_list is None:
            progress_list = self._get_all_user_progress()
        sorted_list = sorted(progress_list, key=lambda x: x.get('totalXP', 0), reverse=True)
        for idx, p in enumerate(sorted_list, 1):
            if p.get('user_id') == user_id:
                return {
                    'rank': idx,
                    'totalXP': p.get('totalXP', 0),
                    'level': p.get('totalXP', 0) // 100 + 1,
                }
        return {'rank': None, 'totalXP': 0, 'level': 1}

    def _get_guest_leaderboard(self, user_id: str, limit: int) -> dict:
        from app.services.user_group_service import user_group_service
        user_groups = user_group_service.get_user_groups_for_user(user_id)

        if not user_groups:
            return {
                'type': 'self_only',
                'current_user': self._get_user_rank_info(user_id),
            }

        all_progress = self._get_all_user_progress()
        user_map = self._get_user_map()
        progress_map = {p['user_id']: p for p in all_progress}

        groups_data = []
        for group in user_groups:
            member_ids = group.get('member_ids', [])
            group_progress = []
            for member_id in member_ids:
                if member_id in progress_map:
                    group_progress.append(progress_map[member_id])
                else:
                    group_progress.append({'user_id': member_id, 'totalXP': 0, 'level': 1})
            group_progress.sort(key=lambda x: x.get('totalXP', 0), reverse=True)
            leaderboard = []
            for idx, p in enumerate(group_progress[:limit], 1):
                leaderboard.append(self._build_leaderboard_entry(p, idx, user_map))
            groups_data.append({
                'group_id': group['id'],
                'group_name': group['name'],
                'leaderboard': leaderboard,
            })

        return {
            'type': 'groups',
            'groups': groups_data,
            'current_user': self._get_user_rank_info(user_id, all_progress),
        }

    def _get_employee_leaderboard(self, user_id: str, limit: int) -> dict:
        all_progress = self._get_all_user_progress()
        employee_progress = [p for p in all_progress if p.get('user_id', '').startswith('emp_')]
        employee_progress.sort(key=lambda x: x.get('totalXP', 0), reverse=True)
        user_map = self._get_user_map()
        leaderboard = []
        for idx, p in enumerate(employee_progress[:limit], 1):
            leaderboard.append(self._build_leaderboard_entry(p, idx, user_map))
        return {
            'type': 'employees',
            'leaderboard': leaderboard,
            'current_user': self._get_user_rank_info(user_id, employee_progress),
        }

    def _get_syllabus_leaderboard(self, syllabus_id: str, user_id: str, limit: int) -> dict:
        all_progress = self._get_all_user_progress()
        syllabus_progress = []
        for p in all_progress:
            xp_by_syllabus = p.get('xpBySyllabus', {})
            syllabus_xp = xp_by_syllabus.get(syllabus_id, 0)
            if syllabus_xp > 0:
                syllabus_progress.append({**p, 'syllabusXP': syllabus_xp})
        syllabus_progress.sort(key=lambda x: x.get('syllabusXP', 0), reverse=True)
        user_map = self._get_user_map()
        leaderboard = []
        for idx, p in enumerate(syllabus_progress[:limit], 1):
            entry = self._build_leaderboard_entry(p, idx, user_map)
            entry['syllabusXP'] = p.get('syllabusXP', 0)
            leaderboard.append(entry)

        from app.services.syllabus_service import syllabus_service
        syllabus = syllabus_service.get_syllabus(syllabus_id)
        syllabus_name = syllabus.get('name', '未知课程表') if syllabus else '未知课程表'

        current_user_info = {'rank': None, 'totalXP': 0, 'syllabusXP': 0, 'level': 1}
        for idx, p in enumerate(syllabus_progress, 1):
            if p.get('user_id') == user_id:
                current_user_info = {
                    'rank': idx,
                    'totalXP': p.get('totalXP', 0),
                    'syllabusXP': p.get('syllabusXP', 0),
                    'level': p.get('totalXP', 0) // 100 + 1,
                }
                break

        return {
            'type': 'syllabus',
            'syllabus_id': syllabus_id,
            'syllabus_name': syllabus_name,
            'leaderboard': leaderboard,
            'current_user': current_user_info,
        }

    def get_leaderboard(self, user_id: str, user_type: str, leaderboard_type: str = 'auto',
                        syllabus_id: str = None, limit: int = 50) -> dict:
        try:
            if leaderboard_type == 'syllabus' and syllabus_id:
                return self._get_syllabus_leaderboard(syllabus_id, user_id, limit)
            if user_type == 'employee':
                return self._get_employee_leaderboard(user_id, limit)
            return self._get_guest_leaderboard(user_id, limit)
        except Exception as e:
            print(f"❌ 获取排行榜失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {'type': 'self_only', 'current_user': {'rank': None, 'totalXP': 0, 'level': 1}}

    def recalculate_all_total_xp(self) -> dict:
        try:
            all_progress = UserProgress.query.all()
            details = []
            updated_count = 0

            for p in all_progress:
                old_xp = p.total_xp or 0
                try:
                    xp_by_syllabus = json.loads(p.xp_by_syllabus or '{}')
                except (json.JSONDecodeError, TypeError):
                    xp_by_syllabus = {}
                new_xp = sum(xp_by_syllabus.values()) if xp_by_syllabus else 0
                details.append({
                    'user_id': p.user_id,
                    'old_xp': old_xp,
                    'new_xp': new_xp,
                    'diff': new_xp - old_xp,
                })
                if old_xp != new_xp:
                    p.total_xp = new_xp
                    updated_count += 1

            db.session.commit()
            return {
                'success': True,
                'total_users': len(all_progress),
                'updated_users': updated_count,
                'details': details,
            }
        except Exception as e:
            db.session.rollback()
            print(f"❌ 重新计算 totalXP 失败: {str(e)}")
            return {'success': False, 'message': str(e), 'total_users': 0, 'updated_users': 0, 'details': []}

    def rebuild_scores_from_progress(self) -> dict:
        """从 Progress.firstPassedQuizzes 重建缺失的 Scores 记录"""
        from app.services.sheets_service import sheets_service
        from app.models.score import Score

        QUESTIONS_PER_QUIZ = 10
        POINTS_PER_QUESTION = 5

        all_progress = self._get_all_user_progress()
        all_scores = sheets_service.get_all_scores()
        existing_scores = {(s.get('user_id'), s.get('survey_id')) for s in all_scores}

        rebuilt = []
        skipped = []

        for progress in all_progress:
            user_id = progress.get('user_id')
            if not user_id:
                continue
            first_passed = progress.get('firstPassedQuizzes', [])
            if isinstance(first_passed, str):
                try:
                    first_passed = json.loads(first_passed)
                except (json.JSONDecodeError, TypeError):
                    first_passed = []
            if not first_passed:
                continue

            for survey_id in first_passed:
                if (user_id, survey_id) in existing_scores:
                    skipped.append({'user_id': user_id, 'survey_id': survey_id, 'reason': '已有记录'})
                    continue
                questions = sheets_service.get_questions_by_survey(survey_id)
                if not questions:
                    skipped.append({'user_id': user_id, 'survey_id': survey_id, 'reason': '测验不存在'})
                    continue

                max_score = QUESTIONS_PER_QUIZ * POINTS_PER_QUESTION
                sheets_service.save_score(
                    user_id=user_id, survey_id=survey_id, attempt_number=1,
                    total_score=max_score, max_score=max_score,
                    correct_count=QUESTIONS_PER_QUIZ, wrong_count=0,
                    retry_count=0, duration_seconds=0,
                )
                rebuilt.append({
                    'user_id': user_id, 'survey_id': survey_id,
                    'total_score': max_score, 'max_score': max_score,
                })

        return {
            'users_processed': len(all_progress),
            'existing_scores': len(existing_scores),
            'rebuilt_count': len(rebuilt),
            'skipped_count': len(skipped),
            'rebuilt': rebuilt,
            'skipped': skipped,
        }


# 单例实例
progress_service = ProgressService()
