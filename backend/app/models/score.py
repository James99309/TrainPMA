"""Score model - corresponds to Google Sheets 'Scores' worksheet"""
from datetime import datetime
from app.models.base import db


class Score(db.Model):
    __tablename__ = 'scores'

    score_id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(100), nullable=False, index=True)
    survey_id = db.Column(db.String(36), nullable=False, index=True)
    attempt_number = db.Column(db.Integer, default=1)
    total_score = db.Column(db.Integer, default=0)
    max_score = db.Column(db.Integer, default=0)
    correct_count = db.Column(db.Integer, default=0)
    wrong_count = db.Column(db.Integer, default=0)
    retry_count = db.Column(db.Integer, default=0)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    duration_seconds = db.Column(db.Integer, default=0)

    def to_dict(self):
        """Output format matches Google Sheets get_all_records() row format"""
        return {
            'score_id': self.score_id,
            'user_id': self.user_id,
            'survey_id': self.survey_id,
            'attempt_number': self.attempt_number or 1,
            'total_score': self.total_score or 0,
            'max_score': self.max_score or 0,
            'correct_count': self.correct_count or 0,
            'wrong_count': self.wrong_count or 0,
            'retry_count': self.retry_count or 0,
            'completed_at': self.completed_at.isoformat() if self.completed_at else '',
            'duration_seconds': self.duration_seconds or 0,
        }
