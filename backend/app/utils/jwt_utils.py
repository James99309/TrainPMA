from flask_jwt_extended import create_access_token, get_jwt_identity, get_jwt, verify_jwt_in_request
from functools import wraps
from flask import jsonify
import uuid

def generate_token(user_id, user_type='guest', accessible_syllabi=None):
    """
    生成JWT Token

    Args:
        user_id: 用户ID
        user_type: 用户类型 ('guest' 或 'employee')
        accessible_syllabi: 客人通过邀请码获得的课程表访问权限列表
    """
    # identity 必须是字符串 (JWT subject 要求，否则会报 "Subject must be a string" 错误)
    identity = str(user_id)

    # 额外信息放入 additional_claims
    additional_claims = {
        'user_type': user_type,
        'accessible_syllabi': accessible_syllabi or []
    }

    return create_access_token(
        identity=identity,
        additional_claims=additional_claims
    )

def get_current_user_id():
    """获取当前用户ID"""
    try:
        verify_jwt_in_request()
        return get_jwt_identity()
    except:
        return None

def get_user_claims():
    """获取当前用户的 JWT claims（包含 user_type, accessible_syllabi 等）"""
    try:
        verify_jwt_in_request()
        return get_jwt()
    except:
        return {}

def jwt_required_custom(fn):
    """自定义JWT验证装饰器"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        kwargs['current_user_id'] = user_id
        return fn(*args, **kwargs)
    return wrapper
