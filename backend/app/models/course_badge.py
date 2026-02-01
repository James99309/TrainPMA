"""CourseBadge model - corresponds to Google Sheets 'CourseBadges' worksheet"""
from datetime import datetime
from app.models.base import db


class CourseBadge(db.Model):
    __tablename__ = 'course_badges'

    badge_id = db.Column(db.String(50), primary_key=True)  # badge-xxxxxxxx
    user_id = db.Column(db.String(100), nullable=False, index=True)
    user_name = db.Column(db.String(100), default='')
    course_id = db.Column(db.String(50), nullable=False)
    course_title = db.Column(db.String(200), default='')
    survey_id = db.Column(db.String(36), default='')
    score = db.Column(db.Integer, default=0)
    max_score = db.Column(db.Integer, default=0)
    percentage = db.Column(db.Integer, default=0)
    attempt_count = db.Column(db.Integer, default=1)
    first_passed_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Composite index for user+course lookups
    __table_args__ = (
        db.Index('idx_badge_user_course', 'user_id', 'course_id'),
    )

    def to_dict(self):
        """Output format matches badge_service._row_to_badge()"""
        return {
            'badge_id': self.badge_id,
            'user_id': self.user_id,
            'user_name': self.user_name or '',
            'course_id': self.course_id,
            'course_title': self.course_title or '',
            'survey_id': self.survey_id or '',
            'score': self.score or 0,
            'max_score': self.max_score or 0,
            'percentage': self.percentage or 0,
            'attempt_count': self.attempt_count or 1,
            'first_passed_at': self.first_passed_at.isoformat() if self.first_passed_at else '',
            'last_updated_at': self.last_updated_at.isoformat() if self.last_updated_at else '',
        }
