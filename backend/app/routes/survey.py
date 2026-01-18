import json
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services import survey_service, sheets_service

survey_bp = Blueprint('survey', __name__, url_prefix='/api/surveys')


def parse_correct_answer(ca, options=None):
    """解析 correct_answer，处理字母和 JSON 字符串格式

    Google Sheets 中的 correct_answer 可能是：
    1. 字母如 "B" - 需要转换为对应选项文本
    2. 多个字母如 "A,B" 或 "AB" - 多选题
    3. JSON 字符串如 "['A','B']"
    4. 直接的文本答案
    """
    if ca is None:
        return None
    if isinstance(ca, (list, dict)):
        return ca

    ca_str = str(ca).strip()

    # 尝试解析 JSON 字符串
    if ca_str.startswith('[') or ca_str.startswith('{'):
        try:
            parsed = json.loads(ca_str)
            # 如果解析后是字母列表，转换为选项文本
            if options and isinstance(parsed, list):
                return convert_letters_to_options(parsed, options)
            return parsed
        except json.JSONDecodeError:
            try:
                parsed = json.loads(ca_str.replace("'", '"'))
                if options and isinstance(parsed, list):
                    return convert_letters_to_options(parsed, options)
                return parsed
            except json.JSONDecodeError:
                pass

    # 处理字母格式的答案（单选或多选）
    if options:
        # 检查是否是单个字母 (A-Z)
        if len(ca_str) == 1 and ca_str.upper() in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            return letter_to_option(ca_str, options)

        # 检查是否是逗号分隔的多个字母 (如 "A,B,C")
        if ',' in ca_str:
            letters = [l.strip() for l in ca_str.split(',')]
            return convert_letters_to_options(letters, options)

        # 检查是否是连续字母 (如 "AB" "ABC")
        if ca_str.isalpha() and all(c.upper() in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' for c in ca_str):
            return convert_letters_to_options(list(ca_str), options)

    return ca_str


def letter_to_option(letter, options):
    """将单个字母转换为对应的选项文本"""
    if not options:
        return letter
    index = ord(letter.upper()) - ord('A')
    if 0 <= index < len(options):
        return options[index]
    return letter


def convert_letters_to_options(letters, options):
    """将字母列表转换为选项文本列表"""
    if not options:
        return letters
    result = []
    for letter in letters:
        letter_str = str(letter).strip()
        if len(letter_str) == 1 and letter_str.upper() in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            opt = letter_to_option(letter_str, options)
            result.append(opt)
        else:
            result.append(letter_str)
    return result

@survey_bp.route('', methods=['GET'])
@jwt_required()
def get_surveys():
    try:
        surveys = survey_service.get_active_surveys()
        user_id = get_jwt_identity()
        result = []
        for s in surveys:
            attempts = sheets_service.get_user_attempts(user_id, s.get('survey_id'))
            max_attempts = int(s.get('max_attempts', 3))
            result.append({**s, 'user_attempts': attempts, 'remaining_attempts': max_attempts - attempts})
        return jsonify({'success': True, 'data': result}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500

@survey_bp.route('/<survey_id>', methods=['GET'])
@jwt_required()
def get_survey(survey_id):
    try:
        survey = survey_service.get_survey_by_id(survey_id)
        if not survey: return jsonify({'success': False, 'message': '问卷不存在'}), 404
        return jsonify({'success': True, 'data': survey}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500

@survey_bp.route('/<survey_id>/questions', methods=['GET'])
def get_questions(survey_id):
    try:
        valid, msg = survey_service.check_survey_time(survey_id)
        if not valid: return jsonify({'success': False, 'message': msg}), 403
        questions = survey_service.get_shuffled_questions(survey_id)

        # 🔧 DEBUG: 打印原始数据
        print("\n=== DEBUG: Questions from Google Sheets ===")
        for i, q in enumerate(questions[:3]):  # 只打印前3题
            print(f"Q{i+1}: {q.get('question_text', '')[:30]}...")
            print(f"    correct_answer (raw): {repr(q.get('correct_answer'))}")
            print(f"    correct_answer type: {type(q.get('correct_answer'))}")
            print(f"    options: {q.get('options')}")

        safe_questions = [{
            'id': q['question_id'],  # 前端期望 'id' 而不是 'question_id'
            'question_id': q['question_id'],  # 保留兼容性
            'question_type': q['question_type'],
            'question_text': q['question_text'],
            'options': q.get('options', []),
            'score': q.get('score', 5),
            'correct_answer': parse_correct_answer(q.get('correct_answer'), q.get('options', []))  # 将字母转换为选项文本
        } for q in questions]

        # 🔧 DEBUG: 打印解析后的数据
        print("\n=== DEBUG: After parsing ===")
        for i, q in enumerate(safe_questions[:3]):
            print(f"Q{i+1}: correct_answer (parsed): {repr(q['correct_answer'])}, type: {type(q['correct_answer'])}")
        print("=" * 50 + "\n")

        return jsonify({'success': True, 'data': safe_questions}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500

@survey_bp.route('/<survey_id>/study-content', methods=['GET'])
@jwt_required()
def get_study_content(survey_id):
    try:
        content = survey_service.get_study_content(survey_id)
        if not content: return jsonify({'success': False, 'message': '问卷不存在'}), 404
        return jsonify({'success': True, 'data': content}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500

@survey_bp.route('/<survey_id>/attempts', methods=['GET'])
@jwt_required()
def get_attempts(survey_id):
    try:
        user_id = get_jwt_identity()
        survey = survey_service.get_survey_by_id(survey_id)
        if not survey: return jsonify({'success': False, 'message': '问卷不存在'}), 404
        attempts = sheets_service.get_user_attempts(user_id, survey_id)
        max_attempts = int(survey.get('max_attempts', 3))
        return jsonify({'success': True, 'data': {'current': attempts, 'max': max_attempts, 'remaining': max_attempts - attempts}}), 200
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500
