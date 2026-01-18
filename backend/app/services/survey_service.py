from app.services.sheets_service import sheets_service
from datetime import datetime
import random

# 固定每次抽取的题目数量
QUESTIONS_PER_QUIZ = 10

class SurveyService:
    @staticmethod
    def get_active_surveys(): return sheets_service.get_active_surveys()
    
    @staticmethod
    def get_survey_by_id(survey_id): return sheets_service.get_survey_by_id(survey_id)
    
    @staticmethod
    def get_shuffled_questions(survey_id):
        """获取随机打乱的题目（最多10题）"""
        questions = sheets_service.get_questions_by_survey(survey_id)
        random.shuffle(questions)
        # 最多返回10题
        return questions[:QUESTIONS_PER_QUIZ]

    @staticmethod
    def get_random_questions_for_user(survey_id, user_id):
        """从题库随机抽取10题，错题优先"""
        all_questions = sheets_service.get_questions_by_survey(survey_id)

        # 题目不足10题，返回全部（打乱顺序）
        if len(all_questions) <= QUESTIONS_PER_QUIZ:
            random.shuffle(all_questions)
            return all_questions

        # 获取用户错题ID列表
        wrong_ids = sheets_service.get_user_wrong_question_ids(user_id, survey_id)

        # 分离错题和其他题
        wrong_questions = [q for q in all_questions if q['question_id'] in wrong_ids]
        other_questions = [q for q in all_questions if q['question_id'] not in wrong_ids]

        # 错题优先抽取
        selected = []
        if wrong_questions:
            take_wrong = min(len(wrong_questions), QUESTIONS_PER_QUIZ)
            selected = random.sample(wrong_questions, take_wrong)

        # 不足部分随机补充
        remaining = QUESTIONS_PER_QUIZ - len(selected)
        if remaining > 0 and other_questions:
            selected.extend(random.sample(other_questions, min(remaining, len(other_questions))))

        random.shuffle(selected)
        return selected

    @staticmethod
    def get_questions_by_survey(survey_id):
        """获取问卷的所有题目（不打乱顺序）"""
        return sheets_service.get_questions_by_survey(survey_id)
    
    @staticmethod
    def get_study_content(survey_id):
        survey = sheets_service.get_survey_by_id(survey_id)
        return {'title': survey.get('title'), 'description': survey.get('description'), 'content': survey.get('study_content_html', '')} if survey else None
    
    @staticmethod
    def check_survey_time(survey_id):
        survey = sheets_service.get_survey_by_id(survey_id)
        if not survey: return False, '问卷不存在'
        try:
            now = datetime.now()

            start_time_str = survey.get('start_time')
            end_time_str = survey.get('end_time')

            # 如果没有设置时间限制，允许访问
            if not start_time_str or not end_time_str:
                return True, 'ok'

            # 解析时间，移除时区信息以便比较
            def parse_datetime(dt_str):
                dt = datetime.fromisoformat(str(dt_str).replace('Z', '+00:00'))
                # 转换为 naive datetime（移除时区信息）
                if dt.tzinfo is not None:
                    dt = dt.replace(tzinfo=None)
                return dt

            start_time = parse_datetime(start_time_str)
            end_time = parse_datetime(end_time_str)

            if now < start_time: return False, '问卷尚未开始'
            if now > end_time: return False, '问卷已结束'
            return True, 'ok'
        except Exception as e:
            # 如果解析失败，允许访问（容错处理）
            print(f"Warning: Failed to parse survey time: {e}")
            return True, 'ok'

survey_service = SurveyService()
