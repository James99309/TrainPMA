"""Question model - corresponds to Google Sheets 'Questions' worksheet"""
import json
from app.models.base import db


class Question(db.Model):
    __tablename__ = 'questions'

    question_id = db.Column(db.String(36), primary_key=True)
    survey_id = db.Column(db.String(36), db.ForeignKey('surveys.survey_id'), nullable=False, index=True)
    question_type = db.Column(db.String(50), nullable=False)  # single_choice, multiple_choice, fill_blank
    question_text = db.Column(db.Text, nullable=False)
    options_json = db.Column(db.Text, default='[]')  # JSON array of option strings
    correct_answer = db.Column(db.String(200), nullable=False)  # A/B/C/D or comma-separated
    score = db.Column(db.Integer, default=5)
    explanation = db.Column(db.Text, default='')
    order_index = db.Column(db.Integer, default=0)

    def to_dict(self):
        """Output format matches Google Sheets get_all_records() row format.
        Note: 'options' is added by sheets_service after parsing options_json."""
        result = {
            'question_id': self.question_id,
            'survey_id': self.survey_id,
            'question_type': self.question_type,
            'question_text': self.question_text,
            'options_json': self.options_json or '[]',
            'correct_answer': self.correct_answer,
            'score': self.score or 5,
            'explanation': self.explanation or '',
            'order_index': self.order_index or 0,
        }
        # Parse options for convenience (matches sheets_service behavior)
        try:
            result['options'] = json.loads(self.options_json) if self.options_json else []
        except (json.JSONDecodeError, TypeError):
            result['options'] = []
        return result
