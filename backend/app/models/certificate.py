"""Certificate model - corresponds to Google Sheets 'Certificates' worksheet"""
import json
from datetime import datetime
from app.models.base import db


class Certificate(db.Model):
    __tablename__ = 'certificates'

    certificate_id = db.Column(db.String(50), primary_key=True)  # cert-xxxxxxxx
    user_id = db.Column(db.String(100), nullable=False, index=True)
    user_name = db.Column(db.String(100), default='')
    user_company = db.Column(db.String(200), default='')
    syllabus_id = db.Column(db.String(50), nullable=False, index=True)
    syllabus_name = db.Column(db.String(200), default='')
    score = db.Column(db.Integer, default=0)
    max_score = db.Column(db.Integer, default=0)
    percentage = db.Column(db.Integer, default=0)
    xp_earned = db.Column(db.Integer, default=0)
    rank = db.Column(db.Integer, default=0)
    total_participants = db.Column(db.Integer, default=0)
    course_scores = db.Column(db.Text, default='{}')  # JSON object
    issued_at = db.Column(db.DateTime, default=datetime.utcnow)
    issued_by = db.Column(db.String(50), default='admin')

    def to_dict(self):
        """Output format matches certificate_service._row_to_certificate()"""
        try:
            cs = json.loads(self.course_scores) if self.course_scores else {}
        except (json.JSONDecodeError, TypeError):
            cs = {}

        return {
            'certificate_id': self.certificate_id,
            'user_id': self.user_id,
            'user_name': self.user_name or '',
            'user_company': self.user_company or '',
            'syllabus_id': self.syllabus_id,
            'syllabus_name': self.syllabus_name or '',
            'score': self.score or 0,
            'max_score': self.max_score or 0,
            'percentage': self.percentage or 0,
            'xp_earned': self.xp_earned or 0,
            'rank': self.rank or 0,
            'total_participants': self.total_participants or 0,
            'course_scores': cs,
            'issued_at': self.issued_at.isoformat() if self.issued_at else '',
            'issued_by': self.issued_by or '',
        }
