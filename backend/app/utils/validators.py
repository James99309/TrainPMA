import re
from datetime import datetime

def validate_phone(phone):
    """验证手机号"""
    # 中国手机号格式
    pattern = r'^1[3-9]\d{9}$'
    return re.match(pattern, phone) is not None

def validate_name(name):
    """验证姓名"""
    if not name or len(name) < 2 or len(name) > 50:
        return False
    return True

def validate_company(company):
    """验证公司名称"""
    if not company or len(company) < 2 or len(company) > 100:
        return False
    return True

def validate_email(email):
    """验证邮箱"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_datetime(date_string):
    """验证日期时间格式"""
    try:
        datetime.fromisoformat(date_string)
        return True
    except:
        return False

def validate_question_type(question_type):
    """验证题目类型"""
    valid_types = ['single_choice', 'multiple_choice', 'fill_blank']
    return question_type in valid_types
