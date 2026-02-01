"""Syllabus model - corresponds to syllabi.json"""
import json
from datetime import datetime
from app.models.base import db


class Syllabus(db.Model):
    __tablename__ = 'syllabi'

    id = db.Column(db.String(50), primary_key=True)  # syl-xxxxxxxx
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    cover_image_url = db.Column(db.String(500), default='')
    course_sequence = db.Column(db.Text, default='[]')     # JSON array of {course_id, order, is_optional}
    access_type = db.Column(db.String(20), default='public')  # public or restricted
    access_rules = db.Column(db.Text, default='{}')        # JSON object
    time_config = db.Column(db.Text, default='{}')         # JSON object
    theme = db.Column(db.String(50), default='default')
    is_published = db.Column(db.Boolean, default=False)
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
        """Output format matches syllabi.json structure exactly"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description or '',
            'cover_image_url': self.cover_image_url or '',
            'course_sequence': self._parse_json(self.course_sequence, []),
            'access_type': self.access_type or 'public',
            'access_rules': self._parse_json(self.access_rules, {
                'allow_guests': True,
                'allow_employees': True,
                'allowed_user_groups': [],
                'allowed_users': [],
            }),
            'time_config': self._parse_json(self.time_config, {
                'type': 'permanent',
                'start_date': None,
                'end_date': None,
            }),
            'theme': self.theme or 'default',
            'is_published': self.is_published or False,
            'created_at': self.created_at.isoformat() if self.created_at else '',
            'updated_at': self.updated_at.isoformat() if self.updated_at else '',
        }
