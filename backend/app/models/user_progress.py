"""UserProgress model - corresponds to Google Sheets 'UserProgress' worksheet"""
import json
from datetime import datetime
from app.models.base import db


class UserProgress(db.Model):
    __tablename__ = 'user_progress'

    progress_id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(100), nullable=False, unique=True, index=True)
    streak = db.Column(db.Integer, default=0)
    total_xp = db.Column(db.Integer, default=0)
    hearts = db.Column(db.Integer, default=5)
    max_hearts = db.Column(db.Integer, default=5)
    daily_goal_minutes = db.Column(db.Integer, default=10)
    current_chapter = db.Column(db.Integer, default=1)
    current_section = db.Column(db.Integer, default=0)
    chapters_completed = db.Column(db.Text, default='[]')       # JSON array
    achievements = db.Column(db.Text, default='[]')              # JSON array
    words_learned = db.Column(db.Text, default='[]')             # JSON array
    total_reading_time = db.Column(db.Integer, default=0)
    onboarding_completed = db.Column(db.Boolean, default=False)
    last_read_date = db.Column(db.String(50), default='')
    courses_completed = db.Column(db.Text, default='[]')         # JSON array
    quizzes_passed = db.Column(db.Integer, default=0)
    quiz_streak = db.Column(db.Integer, default=0)
    last_login_reward_date = db.Column(db.String(50), default='')
    first_passed_quizzes = db.Column(db.Text, default='[]')      # JSON array
    wrong_questions = db.Column(db.Text, default='[]')            # JSON array
    xp_by_syllabus = db.Column(db.Text, default='{}')            # JSON object
    first_login_reward_claimed = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def _parse_json(self, value, default):
        if not value:
            return default
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return default

    def to_dict(self):
        """Output format matches progress_service._row_to_progress() camelCase format"""
        return {
            'streak': self.streak or 0,
            'lastReadDate': self.last_read_date or None,
            'totalXP': self.total_xp or 0,
            'hearts': self.hearts if self.hearts is not None else 5,
            'maxHearts': self.max_hearts if self.max_hearts is not None else 5,
            'dailyGoalMinutes': self.daily_goal_minutes if self.daily_goal_minutes is not None else 10,
            'currentChapter': self.current_chapter if self.current_chapter is not None else 1,
            'currentSection': self.current_section or 0,
            'chaptersCompleted': self._parse_json(self.chapters_completed, []),
            'achievements': self._parse_json(self.achievements, []),
            'wordsLearned': self._parse_json(self.words_learned, []),
            'totalReadingTime': self.total_reading_time or 0,
            'onboardingCompleted': self.onboarding_completed or False,
            'coursesCompleted': self._parse_json(self.courses_completed, []),
            'quizzesPassed': self.quizzes_passed or 0,
            'quizStreak': self.quiz_streak or 0,
            'lastLoginRewardDate': self.last_login_reward_date or None,
            'firstPassedQuizzes': self._parse_json(self.first_passed_quizzes, []),
            'wrongQuestions': self._parse_json(self.wrong_questions, []),
            'xpBySyllabus': self._parse_json(self.xp_by_syllabus, {}),
            'firstLoginRewardClaimed': self.first_login_reward_claimed or False,
        }

    def to_dict_with_user_id(self):
        """to_dict() plus user_id, used for leaderboard calculations"""
        d = self.to_dict()
        d['user_id'] = self.user_id
        return d
