"""Response model - corresponds to Google Sheets 'Responses' worksheet"""
from datetime import datetime
from app.models.base import db


class Response(db.Model):
    __tablename__ = 'responses'

    response_id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(100), nullable=False, index=True)
    survey_id = db.Column(db.String(36), nullable=False, index=True)
    question_id = db.Column(db.String(36), nullable=False)
    user_answer = db.Column(db.Text, default='')
    is_correct = db.Column(db.Boolean, default=False)
    score_earned = db.Column(db.Integer, default=0)
    attempt = db.Column(db.Integer, default=1)
    time_spent_seconds = db.Column(db.Integer, default=0)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Output format matches Google Sheets get_all_records() row format"""
        return {
            'response_id': self.response_id,
            'user_id': self.user_id,
            'survey_id': self.survey_id,
            'question_id': self.question_id,
            'user_answer': self.user_answer or '',
            'is_correct': self.is_correct,  # Already bool in DB
            'score_earned': self.score_earned or 0,
            'attempt': self.attempt or 1,
            'time_spent_seconds': self.time_spent_seconds or 0,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else '',
        }
