"""User model - corresponds to Google Sheets 'Users' worksheet"""
from datetime import datetime
from app.models.base import db


class User(db.Model):
    __tablename__ = 'users'

    user_id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    company = db.Column(db.String(200), default='')
    phone = db.Column(db.String(50), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Output format matches Google Sheets get_all_records() row format"""
        return {
            'user_id': self.user_id,
            'name': self.name,
            'company': self.company,
            'phone': self.phone,
            'created_at': self.created_at.isoformat() if self.created_at else '',
            'updated_at': self.updated_at.isoformat() if self.updated_at else '',
        }
