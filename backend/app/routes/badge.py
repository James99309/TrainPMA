"""
课程徽章路由
提供徽章的查询功能
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.badge_service import badge_service

badge_bp = Blueprint('badge', __name__, url_prefix='/api')


@badge_bp.route('/badges', methods=['GET'])
@jwt_required()
def get_user_badges():
    """
    获取当前用户的所有课程徽章

    Headers:
        Authorization: Bearer <token>

    Response:
        成功: {
            "success": true,
            "data": [
                {
                    "badge_id": "badge-xxx",
                    "user_id": "emp_123",
                    "user_name": "张三",
                    "course_id": "course-xxx",
                    "course_title": "产品培训",
                    "survey_id": "survey-xxx",
                    "score": 50,
                    "max_score": 50,
                    "percentage": 100,
                    "attempt_count": 2,
                    "first_passed_at": "2026-01-22T12:00:00",
                    "last_updated_at": "2026-01-23T10:00:00"
                }
            ]
        }
    """
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '用户未登录'}), 401

        badges = badge_service.get_user_badges(user_id)

        return jsonify({
            'success': True,
            'data': badges
        }), 200

    except Exception as e:
        print(f"❌ 获取用户徽章失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取徽章失败: {str(e)}'
        }), 500


@badge_bp.route('/badges/<badge_id>', methods=['GET'])
def get_badge_detail(badge_id):
    """
    获取徽章详情 (公开访问，用于分享)

    Args:
        badge_id: 徽章ID

    Response:
        成功: {
            "success": true,
            "data": {
                "badge_id": "badge-xxx",
                ...
            }
        }
    """
    try:
        badge = badge_service.get_badge_by_id(badge_id)

        if not badge:
            return jsonify({
                'success': False,
                'message': '徽章不存在'
            }), 404

        return jsonify({
            'success': True,
            'data': badge
        }), 200

    except Exception as e:
        print(f"❌ 获取徽章详情失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取徽章详情失败: {str(e)}'
        }), 500
