from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services import quiz_service, survey_service

quiz_bp = Blueprint('quiz', __name__, url_prefix='/api/quiz')

@quiz_bp.route('/submit', methods=['POST'])
def submit_quiz():
    """提交整个测验答卷（无需JWT认证，使用请求体中的用户名）"""
    try:
        data = request.get_json()
        user_name = data.get('user_name', 'Anonymous')
        survey_id = data.get('survey_id')
        answers = data.get('answers', [])

        if not survey_id:
            return jsonify({'success': False, 'message': '缺少问卷ID'}), 400

        # 计算得分
        result = quiz_service.grade_quiz(user_name, survey_id, answers)
        return jsonify({
            'success': True,
            'total_score': result['total_score'],
            'max_score': result['max_score'],
            'percentage': result['percentage'],
            'passed': result['passed'],
            'results': result['results']
        }), 200
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@quiz_bp.route('/submit-answer', methods=['POST'])
@jwt_required()
def submit_answer():
    """提交单个答案（需要JWT认证）"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        result = quiz_service.submit_answer(user_id, data.get('question_id'), data.get('user_answer'),
                                           data.get('time_spent_seconds', 0), data.get('attempt', 1), data.get('survey_id'))
        return jsonify({'success': True, 'data': result}), 200
    except ValueError as e: return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500

@quiz_bp.route('/start/<survey_id>', methods=['POST'])
@jwt_required()
def start_quiz(survey_id):
    try:
        user_id = get_jwt_identity()
        valid, msg = survey_service.check_survey_time(survey_id)
        if not valid: return jsonify({'success': False, 'message': msg}), 403
        can_attempt, remaining = quiz_service.check_attempt_limit(user_id, survey_id)
        if not can_attempt: return jsonify({'success': False, 'message': '已达到最大尝试次数'}), 403
        return jsonify({'success': True, 'data': {'attempt_number': int(survey_service.get_survey_by_id(survey_id).get('max_attempts', 3)) - remaining + 1, 'remaining': remaining}}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500

@quiz_bp.route('/wrong/<survey_id>', methods=['GET'])
@jwt_required()
def get_wrong_questions(survey_id):
    try:
        user_id = get_jwt_identity()
        questions = quiz_service.get_wrong_questions(user_id, survey_id)
        safe = [{'question_id': q['question_id'], 'question_type': q['question_type'], 'question_text': q['question_text'], 
                'options': q.get('options', []), 'score': q.get('score', 5)} for q in questions]
        return jsonify({'success': True, 'data': safe}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500

@quiz_bp.route('/finish', methods=['POST'])
@jwt_required()
def finish_quiz():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        result = quiz_service.calculate_final_score(user_id, data.get('survey_id'), data.get('attempt_number', 1))
        return jsonify({'success': True, 'data': result}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500
