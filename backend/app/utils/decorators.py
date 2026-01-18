from functools import wraps
from flask import request, jsonify
from app.utils.jwt_utils import get_current_user_id
import os

def api_key_required(f):
    """API Key验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        expected_key = os.getenv('API_KEY')

        # 调试信息
        print('=== API Key 验证 ===')
        print(f'请求路径: {request.path}')
        print(f'收到的 Key: {api_key[:20] if api_key else "None"}...')
        print(f'期望的 Key: {expected_key[:20] if expected_key else "None"}...')
        print(f'匹配: {api_key == expected_key}')

        if not api_key or api_key != expected_key:
            print('❌ API Key 验证失败')
            return jsonify({'error': 'Invalid or missing API key'}), 401

        print('✅ API Key 验证成功')
        return f(*args, **kwargs)
    return decorated_function

def auth_required(f):
    """认证和授权装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        kwargs['current_user_id'] = user_id
        return f(*args, **kwargs)
    return decorated_function

def validate_json(*required_fields):
    """验证JSON请求体"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({'error': 'Request must be JSON'}), 400
            
            data = request.get_json()
            missing = [field for field in required_fields if field not in data]
            if missing:
                return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400
            
            kwargs['data'] = data
            return f(*args, **kwargs)
        return decorated_function
    return decorator
