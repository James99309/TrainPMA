from app.services.sheets_service import sheets_service

class QuizService:
    @staticmethod
    def check_answer(user_answer, correct_answer, question_type):
        if question_type == 'single_choice':
            return user_answer.strip().upper() == correct_answer.strip().upper()
        elif question_type == 'multiple_choice':
            return set(user_answer.replace(' ', '').split(',')) == set(correct_answer.replace(' ', '').split(','))
        elif question_type == 'fill_blank':
            return user_answer.strip().lower() in [a.strip().lower() for a in correct_answer.split('|')]
        return False
    
    @staticmethod
    def submit_answer(user_id, question_id, user_answer, time_spent_seconds, attempt=1, survey_id=None):
        question = sheets_service.get_question_by_id(question_id, survey_id)
        if not question: raise ValueError('题目不存在')
        is_correct = QuizService.check_answer(user_answer, question.get('correct_answer'), question.get('question_type'))
        score_earned = int(question.get('score', 5)) if is_correct else 0
        response_id = sheets_service.save_response(user_id, question.get('survey_id'), question_id, user_answer, is_correct, score_earned, attempt, time_spent_seconds)
        return {'response_id': response_id, 'is_correct': is_correct, 'score_earned': score_earned,
                'correct_answer': question.get('correct_answer') if not is_correct else None,
                'explanation': question.get('explanation', '') if not is_correct else None}
    
    @staticmethod
    def check_attempt_limit(user_id, survey_id):
        survey = sheets_service.get_survey_by_id(survey_id)
        max_attempts = int(survey.get('max_attempts', 3))
        current = sheets_service.get_user_attempts(user_id, survey_id)
        return (True, max_attempts - current) if current < max_attempts else (False, 0)
    
    @staticmethod
    def get_wrong_questions(user_id, survey_id): return sheets_service.get_wrong_questions(user_id, survey_id)
    
    @staticmethod
    def calculate_final_score(user_id, survey_id, attempt_number):
        responses = [r for r in sheets_service.get_user_responses(user_id, survey_id) if int(r.get('attempt', 1)) == attempt_number]
        total_score = sum(int(r.get('score_earned', 0)) for r in responses)
        correct_count = sum(1 for r in responses if r.get('is_correct'))
        questions = sheets_service.get_questions_by_survey(survey_id)
        max_score = sum(int(q.get('score', 5)) for q in questions)
        duration = sum(int(r.get('time_spent_seconds', 0)) for r in responses)
        score_id = sheets_service.save_score(user_id, survey_id, attempt_number, total_score, max_score, correct_count, len(responses)-correct_count, 0, duration)
        return {'score_id': score_id, 'total_score': total_score, 'max_score': max_score, 'correct_count': correct_count,
                'wrong_count': len(responses)-correct_count, 'percentage': round(total_score/max_score*100, 2) if max_score else 0, 'duration_seconds': duration}
    
    @staticmethod
    def get_leaderboard(survey_id): return sheets_service.get_leaderboard(survey_id)

    @staticmethod
    def grade_quiz(user_name, survey_id, answers):
        """
        评分整个测验

        Args:
            user_name: 用户名
            survey_id: 问卷ID
            answers: 答案列表 [{'question_id': ..., 'answer': ...}, ...]

        Returns:
            评分结果
        """
        from app.services.survey_service import survey_service

        # 获取问卷的所有题目
        questions = survey_service.get_questions_by_survey(survey_id)
        if not questions:
            raise ValueError('问卷不存在或没有题目')

        # 创建题目ID到题目的映射
        question_map = {q['question_id']: q for q in questions}

        total_score = 0
        max_score = sum(int(q.get('score', 5)) for q in questions)
        results = []

        print(f"\n=== DEBUG grade_quiz ===")
        print(f"Received {len(answers)} answers")

        for answer in answers:
            question_id = answer.get('question_id')
            user_answer = answer.get('answer')

            print(f"  Question ID: {question_id}")
            print(f"  User Answer: {repr(user_answer)}")

            if question_id not in question_map:
                print(f"  ⚠️ Question ID not found in map!")
                continue

            question = question_map[question_id]
            correct_answer_raw = question.get('correct_answer')
            options = question.get('options', [])
            question_type = question.get('question_type', 'single_choice')
            question_score = int(question.get('score', 5))

            # 将字母格式的正确答案转换为选项文本（与前端一致）
            correct_answer = QuizService._parse_correct_answer(correct_answer_raw, options)

            print(f"  Correct Answer (raw): {repr(correct_answer_raw)}")
            print(f"  Correct Answer (parsed): {repr(correct_answer)}")
            print(f"  Options: {options}")

            # 检查答案
            is_correct = QuizService._check_answer_flexible(user_answer, correct_answer, question_type)
            print(f"  Is Correct: {is_correct}")

            if is_correct:
                total_score += question_score

            results.append({
                'question_id': question_id,
                'is_correct': is_correct,
                'score': question_score if is_correct else 0,
                'correct_answer': correct_answer
            })

        percentage = round(total_score / max_score * 100, 2) if max_score > 0 else 0

        # 获取及格分数
        survey = survey_service.get_survey_by_id(survey_id)
        pass_score = int(survey.get('pass_score', 60)) if survey else 60

        print(f"Total Score: {total_score}/{max_score} = {percentage}%")
        print(f"Passed: {percentage >= pass_score}")
        print("=" * 50 + "\n")

        return {
            'total_score': total_score,
            'max_score': max_score,
            'percentage': percentage,
            'passed': percentage >= pass_score,
            'results': results
        }

    @staticmethod
    def _parse_correct_answer(ca, options=None):
        """将字母格式的正确答案转换为选项文本（与 survey.py 中的 parse_correct_answer 一致）"""
        import json

        if ca is None:
            return None
        if isinstance(ca, (list, dict)):
            return ca

        ca_str = str(ca).strip()

        # 尝试解析 JSON 字符串
        if ca_str.startswith('[') or ca_str.startswith('{'):
            try:
                parsed = json.loads(ca_str)
                if options and isinstance(parsed, list):
                    return QuizService._convert_letters_to_options(parsed, options)
                return parsed
            except json.JSONDecodeError:
                try:
                    parsed = json.loads(ca_str.replace("'", '"'))
                    if options and isinstance(parsed, list):
                        return QuizService._convert_letters_to_options(parsed, options)
                    return parsed
                except json.JSONDecodeError:
                    pass

        # 处理字母格式的答案
        if options:
            # 单个字母 (A-Z)
            if len(ca_str) == 1 and ca_str.upper() in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
                return QuizService._letter_to_option(ca_str, options)

            # 逗号分隔的多个字母 (如 "A,B,C")
            if ',' in ca_str:
                letters = [l.strip() for l in ca_str.split(',')]
                return QuizService._convert_letters_to_options(letters, options)

            # 连续字母 (如 "AB" "ABC")
            if ca_str.isalpha() and all(c.upper() in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' for c in ca_str):
                return QuizService._convert_letters_to_options(list(ca_str), options)

        return ca_str

    @staticmethod
    def _letter_to_option(letter, options):
        """将单个字母转换为对应的选项文本"""
        if not options:
            return letter
        index = ord(letter.upper()) - ord('A')
        if 0 <= index < len(options):
            return options[index]
        return letter

    @staticmethod
    def _convert_letters_to_options(letters, options):
        """将字母列表转换为选项文本列表"""
        if not options:
            return letters
        result = []
        for letter in letters:
            letter_str = str(letter).strip()
            if len(letter_str) == 1 and letter_str.upper() in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
                opt = QuizService._letter_to_option(letter_str, options)
                result.append(opt)
            else:
                result.append(letter_str)
        return result

    @staticmethod
    def _check_answer_flexible(user_answer, correct_answer, question_type):
        """灵活的答案检查，支持多种格式"""
        if user_answer is None or correct_answer is None:
            return False

        if question_type == 'single_choice':
            # 单选题：直接比较
            return str(user_answer).strip().upper() == str(correct_answer).strip().upper()

        elif question_type == 'multiple_choice':
            # 多选题：比较集合
            if isinstance(user_answer, list):
                user_set = set(str(a).strip().upper() for a in user_answer)
            else:
                user_set = set(str(user_answer).replace(' ', '').upper().split(','))

            if isinstance(correct_answer, list):
                correct_set = set(str(a).strip().upper() for a in correct_answer)
            else:
                correct_set = set(str(correct_answer).replace(' ', '').upper().split(','))

            return user_set == correct_set

        elif question_type == 'fill_blank':
            # 填空题：支持多个正确答案（用|分隔）
            user_str = str(user_answer).strip().lower()
            if isinstance(correct_answer, list):
                return user_str in [str(a).strip().lower() for a in correct_answer]
            correct_options = str(correct_answer).split('|')
            return user_str in [a.strip().lower() for a in correct_options]

        return False

quiz_service = QuizService()
