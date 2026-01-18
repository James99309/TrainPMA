from app.services.sheets_service import sheets_service
from datetime import datetime
import random

class SurveyService:
    @staticmethod
    def get_active_surveys(): return sheets_service.get_active_surveys()
    
    @staticmethod
    def get_survey_by_id(survey_id): return sheets_service.get_survey_by_id(survey_id)
    
    @staticmethod
    def get_shuffled_questions(survey_id):
        questions = sheets_service.get_questions_by_survey(survey_id)
        random.shuffle(questions)
        return questions

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
