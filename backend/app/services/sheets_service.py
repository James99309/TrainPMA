"""
数据库服务 (PostgreSQL 版)
替代原 Google Sheets 数据层，保持所有方法签名和返回格式不变
"""
from datetime import datetime
import uuid
import json

from app.models.base import db
from app.models.user import User
from app.models.survey import Survey
from app.models.question import Question
from app.models.response import Response
from app.models.score import Score


class SheetsService:
    """数据库服务 - 使用 SQLAlchemy 替代 Google Sheets
    保持与原 SheetsService 完全相同的方法签名和返回格式"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SheetsService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        print("✅ SheetsService (PostgreSQL) 初始化成功")

    def clear_cache(self, category=None):
        """No-op: PostgreSQL 不需要内存缓存"""
        pass

    # ---- Users ----

    def create_user(self, name, company, phone):
        user_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        user = User(
            user_id=user_id,
            name=name,
            company=company,
            phone=phone,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.session.add(user)
        db.session.commit()
        return {'user_id': user_id, 'name': name, 'company': company, 'phone': phone, 'created_at': now}

    def find_user_by_phone(self, phone):
        user = User.query.filter_by(phone=str(phone)).first()
        return user.to_dict() if user else None

    def get_user_by_id(self, user_id):
        user = db.session.get(User, user_id)
        return user.to_dict() if user else None

    def search_users(self, query, limit=20):
        query_lower = f'%{query.lower()}%'
        users = User.query.filter(
            db.or_(
                User.name.ilike(query_lower),
                User.company.ilike(query_lower),
                User.phone.ilike(query_lower),
            )
        ).limit(limit).all()
        return [
            {
                'user_id': u.user_id,
                'name': u.name,
                'company': u.company,
                'phone': u.phone,
                'created_at': u.created_at.isoformat() if u.created_at else '',
            }
            for u in users
        ]

    def get_all_users(self, limit=100, offset=0):
        users = User.query.offset(offset).limit(limit).all()
        return [
            {
                'user_id': u.user_id,
                'name': u.name,
                'company': u.company,
                'phone': u.phone,
                'created_at': u.created_at.isoformat() if u.created_at else '',
            }
            for u in users
        ]

    # ---- Surveys ----

    def create_survey(self, title, description, study_content_html, start_time, end_time,
                      duration_minutes, total_questions, pass_score, max_attempts=3, is_active=True):
        survey_id = str(uuid.uuid4())
        survey = Survey(
            survey_id=survey_id,
            title=title,
            description=description,
            study_content_html=study_content_html,
            start_time=self._parse_datetime(start_time),
            end_time=self._parse_datetime(end_time),
            duration_minutes=int(duration_minutes) if duration_minutes else 0,
            total_questions=int(total_questions) if total_questions else 0,
            pass_score=int(pass_score) if pass_score else 60,
            max_attempts=int(max_attempts) if max_attempts else 3,
            is_active=is_active,
            created_at=datetime.now(),
        )
        db.session.add(survey)
        db.session.commit()
        return survey_id

    def get_all_surveys(self):
        surveys = Survey.query.all()
        return [s.to_dict() for s in surveys]

    def get_active_surveys(self):
        now = datetime.now()
        surveys = Survey.query.filter(
            Survey.is_active == True,
            Survey.start_time <= now,
            Survey.end_time >= now,
        ).all()
        return [s.to_dict() for s in surveys]

    def get_survey_by_id(self, survey_id):
        survey = db.session.get(Survey, survey_id)
        return survey.to_dict() if survey else None

    def update_survey(self, survey_id, title, description, study_content_html, start_time, end_time,
                      duration_minutes, total_questions, pass_score, max_attempts=3):
        survey = db.session.get(Survey, survey_id)
        if not survey:
            raise ValueError('问卷不存在')
        survey.title = title
        survey.description = description
        survey.study_content_html = study_content_html
        survey.start_time = self._parse_datetime(start_time)
        survey.end_time = self._parse_datetime(end_time)
        survey.duration_minutes = int(duration_minutes) if duration_minutes else 0
        survey.total_questions = int(total_questions) if total_questions else 0
        survey.pass_score = int(pass_score) if pass_score else 60
        survey.max_attempts = int(max_attempts) if max_attempts else 3
        db.session.commit()
        return True

    def delete_survey(self, survey_id):
        if not survey_id:
            raise ValueError('问卷ID不能为空')
        survey_id_str = str(survey_id).strip()
        survey = db.session.get(Survey, survey_id_str)
        if not survey:
            raise ValueError(f'问卷不存在 (ID: {survey_id_str})')
        # Delete related questions
        Question.query.filter_by(survey_id=survey_id_str).delete()
        db.session.delete(survey)
        db.session.commit()
        return True

    def _delete_questions_by_survey(self, survey_id):
        Question.query.filter_by(survey_id=survey_id).delete()
        db.session.commit()

    # ---- Questions ----

    def add_questions(self, survey_id, questions):
        rows_added = 0
        for idx, q in enumerate(questions):
            question_id = str(uuid.uuid4())
            options = q.get('options', [])
            options_json = json.dumps(options, ensure_ascii=False) if isinstance(options, list) else options
            correct_answer = q.get('correct_answer', 'A')
            if isinstance(correct_answer, list):
                correct_answer = ','.join(correct_answer)
            question = Question(
                question_id=question_id,
                survey_id=survey_id,
                question_type=q.get('question_type', ''),
                question_text=q.get('question_text', ''),
                options_json=options_json,
                correct_answer=correct_answer,
                score=5,
                explanation=q.get('explanation', ''),
                order_index=idx + 1,
            )
            db.session.add(question)
            rows_added += 1
        db.session.commit()
        return rows_added

    def get_questions_by_survey(self, survey_id):
        questions = Question.query.filter_by(survey_id=survey_id).order_by(Question.order_index).all()
        return [q.to_dict() for q in questions]

    def get_question_by_id(self, question_id, survey_id=None):
        if survey_id:
            q = Question.query.filter_by(question_id=question_id, survey_id=survey_id).first()
        else:
            q = db.session.get(Question, question_id)
        return q.to_dict() if q else None

    # ---- Responses ----

    def save_responses_batch(self, responses):
        for r in responses:
            resp = Response(
                response_id=str(uuid.uuid4()),
                user_id=r.get('user_id', ''),
                survey_id=r.get('survey_id', ''),
                question_id=r.get('question_id', ''),
                user_answer=str(r.get('user_answer', '')),
                is_correct=bool(r.get('is_correct')),
                score_earned=int(r.get('score_earned', 0)),
                attempt=int(r.get('attempt', 1)),
                time_spent_seconds=int(r.get('time_spent_seconds', 0)),
                submitted_at=self._parse_datetime(r.get('submitted_at')) or datetime.now(),
            )
            db.session.add(resp)
        db.session.commit()
        return len(responses)

    def save_response(self, user_id, survey_id, question_id, user_answer, is_correct, score_earned, attempt, time_spent_seconds):
        response_id = str(uuid.uuid4())
        resp = Response(
            response_id=response_id,
            user_id=user_id,
            survey_id=survey_id,
            question_id=question_id,
            user_answer=str(user_answer),
            is_correct=bool(is_correct),
            score_earned=int(score_earned),
            attempt=int(attempt),
            time_spent_seconds=int(time_spent_seconds),
            submitted_at=datetime.now(),
        )
        db.session.add(resp)
        db.session.commit()
        return response_id

    def get_user_responses(self, user_id, survey_id):
        responses = Response.query.filter_by(user_id=user_id, survey_id=survey_id).all()
        return [r.to_dict() for r in responses]

    def get_user_wrong_question_ids(self, user_id, survey_id):
        """获取用户在该问卷中最近一次做错的题目ID列表"""
        responses = self.get_user_responses(user_id, survey_id)
        latest_by_question = {}
        for r in responses:
            qid = r.get('question_id')
            submitted = r.get('submitted_at', '')
            if qid not in latest_by_question or submitted > latest_by_question[qid]['submitted_at']:
                latest_by_question[qid] = r
        return [qid for qid, r in latest_by_question.items() if not r.get('is_correct')]

    def get_wrong_questions(self, user_id, survey_id):
        responses = self.get_user_responses(user_id, survey_id)
        wrong_ids = [r['question_id'] for r in responses if not r['is_correct'] and int(r.get('attempt', 1)) == 1]
        return [q for q in self.get_questions_by_survey(survey_id) if q['question_id'] in wrong_ids]

    # ---- Scores ----

    def save_score(self, user_id, survey_id, attempt_number, total_score, max_score, correct_count, wrong_count, retry_count, duration_seconds):
        score_id = str(uuid.uuid4())
        score = Score(
            score_id=score_id,
            user_id=user_id,
            survey_id=survey_id,
            attempt_number=int(attempt_number),
            total_score=int(total_score),
            max_score=int(max_score),
            correct_count=int(correct_count),
            wrong_count=int(wrong_count),
            retry_count=int(retry_count),
            completed_at=datetime.now(),
            duration_seconds=int(duration_seconds),
        )
        db.session.add(score)
        db.session.commit()
        return score_id

    def update_score(self, user_id: str, survey_id: str, updates: dict) -> bool:
        score = Score.query.filter_by(user_id=user_id, survey_id=survey_id).first()
        if not score:
            return False
        if 'total_score' in updates:
            score.total_score = updates['total_score']
        if 'max_score' in updates:
            score.max_score = updates['max_score']
        if 'correct_count' in updates:
            score.correct_count = updates['correct_count']
        if 'wrong_count' in updates:
            score.wrong_count = updates['wrong_count']
        db.session.commit()
        return True

    def get_leaderboard(self, survey_id, limit=100):
        scores = Score.query.filter_by(survey_id=survey_id).all()
        user_best = {}
        for s in scores:
            uid = s.user_id
            total = s.total_score or 0
            dur = s.duration_seconds or 0
            if uid not in user_best or total > (user_best[uid].total_score or 0) or \
               (total == (user_best[uid].total_score or 0) and dur < (user_best[uid].duration_seconds or 0)):
                user_best[uid] = s
        sorted_scores = sorted(user_best.values(), key=lambda x: (-(x.total_score or 0), x.duration_seconds or 0))

        # Build user name map
        user_ids = [s.user_id for s in sorted_scores[:limit]]
        users = {u.user_id: u for u in User.query.filter(User.user_id.in_(user_ids)).all()} if user_ids else {}

        result = []
        for i, s in enumerate(sorted_scores[:limit]):
            user = users.get(s.user_id)
            result.append({
                'rank': i + 1,
                'user_id': s.user_id,
                'name': user.name if user else '未知',
                'company': user.company if user else '',
                'score': s.total_score or 0,
                'max_score': s.max_score or 0,
                'correct_count': s.correct_count or 0,
                'duration_seconds': s.duration_seconds or 0,
            })
        return result

    def get_user_attempts(self, user_id, survey_id):
        return Score.query.filter_by(user_id=user_id, survey_id=survey_id).count()

    def get_user_best_score(self, user_id: str, survey_id: str) -> dict | None:
        scores = Score.query.filter_by(user_id=user_id, survey_id=survey_id).all()
        if not scores:
            return None
        best = max(scores, key=lambda x: (x.total_score or 0))
        return {
            'total_score': best.total_score or 0,
            'max_score': best.max_score or 0,
            'correct_count': best.correct_count or 0,
            'wrong_count': best.wrong_count or 0,
            'completed_at': best.completed_at.isoformat() if best.completed_at else '',
        }

    def get_all_scores(self) -> list:
        scores = Score.query.all()
        return [s.to_dict() for s in scores]

    # ---- Helpers ----

    @staticmethod
    def _parse_datetime(val):
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(str(val))
        except (ValueError, TypeError):
            return None


sheets_service = SheetsService()
