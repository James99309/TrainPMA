from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services import quiz_service

leaderboard_bp = Blueprint('leaderboard', __name__, url_prefix='/api/leaderboard')

@leaderboard_bp.route('/<survey_id>', methods=['GET'])
@jwt_required(optional=True)  # 排行榜可公开访问，登录用户可看到自己的排名
def get_leaderboard(survey_id):
    try:
        user_id = get_jwt_identity()  # 可能为 None（未登录）
        leaderboard = quiz_service.get_leaderboard(survey_id)
        user_rank = None
        if user_id:
            user_rank = next((item for item in leaderboard if item.get('user_id') == user_id), None)
        return jsonify({'success': True, 'data': {'leaderboard': leaderboard, 'user_rank': user_rank}}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500
