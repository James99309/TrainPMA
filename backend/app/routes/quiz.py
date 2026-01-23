from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.services import quiz_service, survey_service
from app.services.sheets_service import sheets_service
# badge_service 使用延迟导入，避免初始化失败导致整个模块无法加载

quiz_bp = Blueprint('quiz', __name__, url_prefix='/api/quiz')

@quiz_bp.route('/submit', methods=['POST'])
def submit_quiz():
    """提交整个测验答卷（可选JWT认证，如果有则保存成绩到排行榜）"""
    try:
        data = request.get_json()
        user_name = data.get('user_name', 'Anonymous')
        survey_id = data.get('survey_id')
        answers = data.get('answers', [])

        if not survey_id:
            return jsonify({'success': False, 'message': '缺少问卷ID'}), 400

        # 尝试获取用户ID（如果有JWT token）
        user_id = None
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            print(f"🔐 JWT user_id: {user_id}")
        except Exception as e:
            print(f"🔐 JWT 获取失败: {str(e)}")

        # 计算得分
        result = quiz_service.grade_quiz(user_name, survey_id, answers)
        print(f"📊 测验结果: passed={result['passed']}, score={result['total_score']}/{result['max_score']}, percentage={result['percentage']}%")

        # 如果有登录用户，保存成绩到 Scores 表
        if user_id and result['passed']:
            # 1. 先保存分数（独立 try，不受徽章逻辑影响）
            try:
                # 获取用户当前尝试次数
                current_attempts = sheets_service.get_user_attempts(user_id, survey_id)
                attempt_number = current_attempts + 1

                # 计算正确/错误数量
                correct_count = sum(1 for r in result['results'] if r['is_correct'])
                wrong_count = len(result['results']) - correct_count

                # 保存成绩
                sheets_service.save_score(
                    user_id=user_id,
                    survey_id=survey_id,
                    attempt_number=attempt_number,
                    total_score=result['total_score'],
                    max_score=result['max_score'],
                    correct_count=correct_count,
                    wrong_count=wrong_count,
                    retry_count=0,
                    duration_seconds=data.get('time_taken_seconds', 0)
                )
                print(f"✅ 保存测验成绩: user={user_id}, survey={survey_id}, score={result['total_score']}/{result['max_score']}")
            except Exception as e:
                print(f"⚠️ 保存测验成绩失败: {str(e)}")

            # 2. 再发放徽章（独立 try，使用延迟导入）
            try:
                from app.services.badge_service import get_badge_service
                badge_svc = get_badge_service()
                course_info = badge_svc.get_course_by_survey_id(survey_id)
                if course_info:
                    badge_result = badge_svc.issue_or_update_badge(
                        user_id=user_id,
                        course_id=course_info['course_id'],
                        course_title=course_info['course_title'],
                        survey_id=survey_id,
                        score=result['total_score'],
                        max_score=result['max_score'],
                        percentage=result['percentage']
                    )
                    if badge_result.get('success'):
                        is_new = badge_result.get('is_new')
                        score_updated = badge_result.get('score_updated')
                        print(f"🏅 徽章处理完成: is_new={is_new}, score_updated={score_updated}")
            except Exception as badge_err:
                print(f"⚠️ 发放徽章失败: {str(badge_err)}")

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
        # 固定每题5分
        safe = [{'question_id': q['question_id'], 'question_type': q['question_type'], 'question_text': q['question_text'],
                'options': q.get('options', []), 'score': 5} for q in questions]
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
