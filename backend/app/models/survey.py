"""Survey model - corresponds to Google Sheets 'Surveys' worksheet"""
from datetime import datetime
from app.models.base import db


class Survey(db.Model):
    __tablename__ = 'surveys'

    survey_id = db.Column(db.String(36), primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    study_content_html = db.Column(db.Text, default='')
    start_time = db.Column(db.DateTime, nullable=True)
    end_time = db.Column(db.DateTime, nullable=True)
    duration_minutes = db.Column(db.Integer, default=0)
    total_questions = db.Column(db.Integer, default=0)
    pass_score = db.Column(db.Integer, default=60)
    max_attempts = db.Column(db.Integer, default=3)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Output format matches Google Sheets get_all_records() row format"""
        return {
            'survey_id': self.survey_id,
            'title': self.title,
            'description': self.description or '',
            'study_content_html': self.study_content_html or '',
            'start_time': self.start_time.isoformat() if self.start_time else '',
            'end_time': self.end_time.isoformat() if self.end_time else '',
            'duration_minutes': self.duration_minutes or 0,
            'total_questions': self.total_questions or 0,
            'pass_score': self.pass_score or 60,
            'max_attempts': self.max_attempts or 3,
            'is_active': 'TRUE' if self.is_active else 'FALSE',
            'created_at': self.created_at.isoformat() if self.created_at else '',
        }
