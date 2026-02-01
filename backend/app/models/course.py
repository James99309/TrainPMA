"""Course model - corresponds to courses.json"""
import json
from datetime import datetime
from app.models.base import db


class Course(db.Model):
    __tablename__ = 'courses'

    id = db.Column(db.String(50), primary_key=True)  # course-xxxxxxxx
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    type = db.Column(db.String(20), default='pdf')
    media_url = db.Column(db.String(500), default='')
    thumbnail_url = db.Column(db.String(500), default='')
    total_pages = db.Column(db.Integer, default=0)
    duration_minutes = db.Column(db.Integer, default=0)
    order = db.Column(db.Integer, default=0)
    tags = db.Column(db.Text, default='[]')           # JSON array
    prerequisites = db.Column(db.Text, default='[]')   # JSON array
    is_published = db.Column(db.Boolean, default=True)
    icon = db.Column(db.String(50), default=None, nullable=True)
    quiz_survey_id = db.Column(db.String(36), default=None, nullable=True)
    quiz_pass_score = db.Column(db.Integer, default=60, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def _parse_json(self, value, default):
        if not value:
            return default
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return default

    def to_dict(self):
        """Output format matches courses.json structure exactly"""
        result = {
            'id': self.id,
            'title': self.title,
            'description': self.description or '',
            'type': self.type or 'pdf',
            'mediaUrl': self.media_url or f'/api/courses/{self.id}/content.pdf',
            'thumbnailUrl': self.thumbnail_url or f'/courses/{self.id}/thumbnail.png',
            'totalPages': self.total_pages or 0,
            'duration_minutes': self.duration_minutes or 0,
            'order': self.order or 0,
            'tags': self._parse_json(self.tags, []),
            'prerequisites': self._parse_json(self.prerequisites, []),
            'is_published': self.is_published if self.is_published is not None else True,
            'icon': self.icon,
            'created_at': self.created_at.isoformat() if self.created_at else '',
        }
        if self.updated_at:
            result['updated_at'] = self.updated_at.isoformat()
        if self.quiz_survey_id:
            result['quiz'] = {
                'survey_id': self.quiz_survey_id,
                'pass_score': self.quiz_pass_score or 60,
            }
        return result
