"""UserGroup model - corresponds to Google Sheets 'UserGroups' worksheet"""
import json
from datetime import datetime
from app.models.base import db


class UserGroup(db.Model):
    __tablename__ = 'user_groups'

    group_id = db.Column(db.String(50), primary_key=True)  # grp-xxxxxxxx
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    member_ids = db.Column(db.Text, default='[]')  # JSON array of user_id strings
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_member_ids(self):
        """Parse member_ids JSON to list"""
        if not self.member_ids:
            return []
        try:
            return json.loads(self.member_ids)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_member_ids(self, ids: list):
        """Set member_ids from list"""
        self.member_ids = json.dumps(ids, ensure_ascii=False)

    def to_dict(self):
        """Output format matches user_group_service._row_to_group()
        Note: uses 'id' not 'group_id' for backwards compatibility"""
        return {
            'id': self.group_id,
            'name': self.name,
            'description': self.description or '',
            'member_ids': self.get_member_ids(),
            'created_at': self.created_at.isoformat() if self.created_at else '',
            'updated_at': self.updated_at.isoformat() if self.updated_at else '',
        }
