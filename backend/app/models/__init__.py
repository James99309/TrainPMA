"""SQLAlchemy models for TrainPMA"""
from app.models.base import db
from app.models.user import User
from app.models.survey import Survey
from app.models.question import Question
from app.models.response import Response
from app.models.score import Score
from app.models.user_progress import UserProgress
from app.models.certificate import Certificate
from app.models.course_badge import CourseBadge
from app.models.user_group import UserGroup
from app.models.course import Course
from app.models.syllabus import Syllabus

__all__ = [
    'db',
    'User', 'Survey', 'Question', 'Response', 'Score',
    'UserProgress', 'Certificate', 'CourseBadge', 'UserGroup',
    'Course', 'Syllabus',
]
