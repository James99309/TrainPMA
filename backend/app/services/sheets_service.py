import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime, timedelta
import uuid
import json
import os
import threading

class SheetsService:
    """Google Sheets 数据库服务 (优化版 - 带缓存)"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(SheetsService, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        try:
            scope = [
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive'
            ]
            
            creds_file = os.getenv('GOOGLE_CREDENTIALS_FILE', 'credentials/service-account.json')
            creds = ServiceAccountCredentials.from_json_keyfile_name(creds_file, scope)
            self.client = gspread.authorize(creds)
            
            sheets_id = os.getenv('GOOGLE_SHEETS_ID')
            self.spreadsheet = self.client.open_by_key(sheets_id)
            
            self.users_sheet = self.spreadsheet.worksheet('Users')
            self.surveys_sheet = self.spreadsheet.worksheet('Surveys')
            self.questions_sheet = self.spreadsheet.worksheet('Questions')
            self.responses_sheet = self.spreadsheet.worksheet('Responses')
            self.scores_sheet = self.spreadsheet.worksheet('Scores')
            try:
                self.user_groups_sheet = self.spreadsheet.worksheet('UserGroups')
            except gspread.exceptions.WorksheetNotFound:
                self.user_groups_sheet = self.spreadsheet.add_worksheet(
                    title='UserGroups', rows=100, cols=6)
                self.user_groups_sheet.append_row(
                    ['group_id', 'name', 'description', 'member_ids', 'created_at', 'updated_at'])
                print("📋 已自动创建 UserGroups worksheet")

            # 缓存
            self._cache = {'surveys': {}, 'questions': {}, 'users': {}, 'leaderboard': {}, 'user_groups': {}}
            self._cache_ttl = {'surveys': 300, 'questions': 600, 'users': 300, 'leaderboard': 60, 'user_groups': 300}

            self._initialized = True
            print("✅ Google Sheets 连接成功")

            # 自动迁移：如果 UserGroups 为空且 user_groups.json 存在，自动导入
            self._auto_migrate_user_groups()
        except Exception as e:
            print(f"❌ Google Sheets 连接失败: {str(e)}")
            raise
    
    def _get_cache(self, category, key='default'):
        entry = self._cache.get(category, {}).get(key)
        if entry and datetime.now() < entry.get('expires', datetime.min):
            return entry['data']
        return None
    
    def _set_cache(self, category, key, data):
        ttl = self._cache_ttl.get(category, 300)
        if category not in self._cache:
            self._cache[category] = {}
        self._cache[category][key] = {'data': data, 'expires': datetime.now() + timedelta(seconds=ttl)}
    
    def clear_cache(self, category=None):
        if category:
            self._cache[category] = {}
        else:
            self._cache = {'surveys': {}, 'questions': {}, 'users': {}, 'leaderboard': {}, 'user_groups': {}}

    def _auto_migrate_user_groups(self):
        """启动时自动迁移：如果 Sheets 中 UserGroups 为空且 user_groups.json 存在，则自动导入并修正旧 ID"""
        try:
            existing = self.user_groups_sheet.get_all_values()
            if len(existing) > 1:
                return  # 已有数据，跳过

            data_dir = os.getenv('DATA_DIR', os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data'))
            json_path = os.path.join(data_dir, 'user_groups.json')

            if not os.path.exists(json_path):
                return  # JSON 文件不存在，跳过

            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            groups = data.get('user_groups', [])
            if not groups:
                return

            # 尝试获取原始员工数据构建 ID 映射
            id_mapping = {}
            try:
                from app.services.pma_api_service import get_raw_employees
                raw_employees = get_raw_employees()
                for emp in raw_employees:
                    raw_user_id = emp.get('user_id')
                    raw_id = emp.get('id')
                    source = emp.get('source', 'sp8d')
                    if raw_user_id is not None and raw_id is not None and str(raw_user_id) != str(raw_id):
                        if source == 'ovs':
                            id_mapping[f"emp_ovs_{raw_user_id}"] = f"emp_ovs_{raw_id}"
                        else:
                            id_mapping[f"emp_{raw_user_id}"] = f"emp_{raw_id}"
            except Exception as e:
                print(f"⚠️ 获取员工映射失败，将直接迁移不修正 ID: {e}")

            rows_to_add = []
            fix_count = 0
            for group in groups:
                old_member_ids = group.get('member_ids', [])
                new_member_ids = []
                for mid in old_member_ids:
                    if mid in id_mapping:
                        new_member_ids.append(id_mapping[mid])
                        fix_count += 1
                    else:
                        new_member_ids.append(mid)

                rows_to_add.append([
                    group.get('id', ''),
                    group.get('name', ''),
                    group.get('description', ''),
                    json.dumps(new_member_ids, ensure_ascii=False),
                    group.get('created_at', ''),
                    group.get('updated_at', ''),
                ])

            if rows_to_add:
                self.user_groups_sheet.append_rows(rows_to_add)

            print(f"📋 已自动迁移 {len(rows_to_add)} 个用户组到 Sheets，修正了 {fix_count} 个旧 ID")
        except Exception as e:
            print(f"⚠️ 用户组自动迁移失败（不影响启动）: {e}")

    # Users
    def create_user(self, name, company, phone):
        user_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        self.users_sheet.append_row([user_id, name, company, phone, now, now])
        return {'user_id': user_id, 'name': name, 'company': company, 'phone': phone, 'created_at': now}
    
    def find_user_by_phone(self, phone):
        try:
            rows = self.users_sheet.get_all_records()
            for row in rows:
                if str(row.get('phone')) == str(phone):
                    return row
        except IndexError:
            # 空表，返回 None
            pass
        return None
    
    def get_user_by_id(self, user_id):
        cached = self._get_cache('users', user_id)
        if cached: return cached
        try:
            rows = self.users_sheet.get_all_records()
            for row in rows:
                if row.get('user_id') == user_id:
                    self._set_cache('users', user_id, row)
                    return row
        except IndexError:
            # 空表，返回 None
            pass
        return None
    
    # Surveys
    def create_survey(self, title, description, study_content_html, start_time, end_time, 
                     duration_minutes, total_questions, pass_score, max_attempts=3, is_active=True):
        survey_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        row = [survey_id, title, description, study_content_html, start_time, end_time,
               duration_minutes, total_questions, pass_score, max_attempts, 'TRUE' if is_active else 'FALSE', now]
        self.surveys_sheet.append_row(row)
        self.clear_cache('surveys')
        return survey_id
    
    def get_all_surveys(self):
        cached = self._get_cache('surveys', 'all')
        if cached: return cached
        try:
            rows = self.surveys_sheet.get_all_records()
        except IndexError:
            rows = []
        self._set_cache('surveys', 'all', rows)
        return rows
    
    def get_active_surveys(self):
        rows = self.get_all_surveys()
        now = datetime.now()
        active = []
        for row in rows:
            try:
                if str(row.get('is_active', 'FALSE')).upper() == 'TRUE':
                    start = datetime.fromisoformat(str(row.get('start_time', '')))
                    end = datetime.fromisoformat(str(row.get('end_time', '')))
                    if start <= now <= end:
                        active.append(row)
            except: continue
        return active
    
    def get_survey_by_id(self, survey_id):
        rows = self.get_all_surveys()
        for row in rows:
            if row.get('survey_id') == survey_id:
                return row
        return None

    def update_survey(self, survey_id, title, description, study_content_html, start_time, end_time,
                     duration_minutes, total_questions, pass_score, max_attempts=3):
        """Update an existing survey"""
        rows = self.surveys_sheet.get_all_values()
        for idx, row in enumerate(rows):
            if idx == 0:  # Skip header
                continue
            if row[0] == survey_id:
                # Update the row (columns: survey_id, title, description, study_content_html,
                # start_time, end_time, duration_minutes, total_questions, pass_score, max_attempts, is_active, created_at)
                updated_row = [survey_id, title, description, study_content_html,
                              start_time, end_time, duration_minutes, total_questions,
                              pass_score, max_attempts, row[10] if len(row) > 10 else 'TRUE',
                              row[11] if len(row) > 11 else datetime.now().isoformat()]
                self.surveys_sheet.update(f'A{idx+1}:L{idx+1}', [updated_row])
                self.clear_cache('surveys')
                return True
        raise ValueError('问卷不存在')

    def delete_survey(self, survey_id):
        """Delete a survey and its questions"""
        if not survey_id:
            raise ValueError('问卷ID不能为空')

        survey_id_str = str(survey_id).strip()
        print(f"[sheets_service] 正在删除考卷: {survey_id_str}")

        rows = self.surveys_sheet.get_all_values()
        print(f"[sheets_service] 共有 {len(rows)} 行数据")

        for idx, row in enumerate(rows):
            if idx == 0:  # Skip header
                continue
            row_id = str(row[0]).strip() if row and len(row) > 0 else ''
            if row_id == survey_id_str:
                print(f"[sheets_service] 找到匹配行 {idx + 1}, 正在删除...")
                self.surveys_sheet.delete_rows(idx + 1)
                self.clear_cache('surveys')
                # Also delete related questions
                self._delete_questions_by_survey(survey_id_str)
                print(f"[sheets_service] ✅ 删除完成")
                return True

        print(f"[sheets_service] ❌ 未找到考卷 ID: {survey_id_str}")
        raise ValueError(f'问卷不存在 (ID: {survey_id_str})')

    def _delete_questions_by_survey(self, survey_id):
        """Delete all questions for a survey"""
        rows = self.questions_sheet.get_all_values()
        rows_to_delete = []
        for idx, row in enumerate(rows):
            if idx == 0:  # Skip header
                continue
            if len(row) > 1 and row[1] == survey_id:
                rows_to_delete.append(idx + 1)
        # Delete from bottom to top to maintain row indices
        for row_idx in reversed(rows_to_delete):
            self.questions_sheet.delete_rows(row_idx)
        self.clear_cache('questions')

    # Questions
    def add_questions(self, survey_id, questions):
        rows_to_add = []
        for idx, q in enumerate(questions):
            question_id = str(uuid.uuid4())
            options = q.get('options', [])
            options_json = json.dumps(options, ensure_ascii=False) if isinstance(options, list) else options
            correct_answer = q.get('correct_answer', 'A')
            if isinstance(correct_answer, list):
                correct_answer = ','.join(correct_answer)
            # 固定每题5分，不再从题目数据读取
            rows_to_add.append([question_id, survey_id, q.get('question_type'), q.get('question_text'),
                               options_json, correct_answer, 5, q.get('explanation', ''), idx + 1])
        self.questions_sheet.append_rows(rows_to_add)
        self.clear_cache('questions')
        return len(rows_to_add)
    
    def get_questions_by_survey(self, survey_id):
        cached = self._get_cache('questions', survey_id)
        if cached: return cached
        try:
            rows = self.questions_sheet.get_all_records()
        except IndexError:
            return []
        questions = []
        for row in rows:
            if row.get('survey_id') == survey_id:
                try:
                    opts = row.get('options_json', '[]')
                    row['options'] = json.loads(opts) if isinstance(opts, str) else opts
                except: row['options'] = []
                questions.append(row)
        result = sorted(questions, key=lambda x: int(x.get('order_index', 0)))
        self._set_cache('questions', survey_id, result)
        return result
    
    def get_question_by_id(self, question_id, survey_id=None):
        if survey_id:
            for q in self.get_questions_by_survey(survey_id):
                if q.get('question_id') == question_id:
                    return q
        try:
            rows = self.questions_sheet.get_all_records()
        except IndexError:
            return None
        for row in rows:
            if row.get('question_id') == question_id:
                try:
                    opts = row.get('options_json', '[]')
                    row['options'] = json.loads(opts) if isinstance(opts, str) else opts
                except: row['options'] = []
                return row
        return None
    
    # Responses
    def save_responses_batch(self, responses):
        rows = []
        for r in responses:
            rows.append([str(uuid.uuid4()), r.get('user_id'), r.get('survey_id'), r.get('question_id'),
                        r.get('user_answer'), 'TRUE' if r.get('is_correct') else 'FALSE', r.get('score_earned', 0),
                        r.get('attempt', 1), r.get('time_spent_seconds', 0), r.get('submitted_at', datetime.now().isoformat())])
        self.responses_sheet.append_rows(rows)
        return len(rows)
    
    def save_response(self, user_id, survey_id, question_id, user_answer, is_correct, score_earned, attempt, time_spent_seconds):
        response_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        self.responses_sheet.append_row([response_id, user_id, survey_id, question_id, user_answer,
                                        'TRUE' if is_correct else 'FALSE', score_earned, attempt, time_spent_seconds, now])
        return response_id
    
    def get_user_responses(self, user_id, survey_id):
        try:
            rows = self.responses_sheet.get_all_records()
            responses = []
            for row in rows:
                if row.get('user_id') == user_id and row.get('survey_id') == survey_id:
                    row['is_correct'] = str(row.get('is_correct', 'FALSE')).upper() == 'TRUE'
                    responses.append(row)
            return responses
        except IndexError:
            # 空表
            return []

    def get_user_wrong_question_ids(self, user_id, survey_id):
        """获取用户在该问卷中最近一次做错的题目ID列表"""
        responses = self.get_user_responses(user_id, survey_id)

        # 按题目分组，取最近一次回答
        latest_by_question = {}
        for r in responses:
            qid = r.get('question_id')
            submitted = r.get('submitted_at', '')
            if qid not in latest_by_question or submitted > latest_by_question[qid]['submitted_at']:
                latest_by_question[qid] = r

        # 返回最近一次回答为错误的题目ID
        return [qid for qid, r in latest_by_question.items() if not r.get('is_correct')]

    def get_wrong_questions(self, user_id, survey_id):
        responses = self.get_user_responses(user_id, survey_id)
        wrong_ids = [r['question_id'] for r in responses if not r['is_correct'] and int(r.get('attempt', 1)) == 1]
        return [q for q in self.get_questions_by_survey(survey_id) if q['question_id'] in wrong_ids]
    
    # Scores
    def save_score(self, user_id, survey_id, attempt_number, total_score, max_score, correct_count, wrong_count, retry_count, duration_seconds):
        score_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        self.scores_sheet.append_row([score_id, user_id, survey_id, attempt_number, total_score, max_score,
                                     correct_count, wrong_count, retry_count, 0, now, duration_seconds])
        self.clear_cache('leaderboard')
        return score_id

    def update_score(self, user_id: str, survey_id: str, updates: dict) -> bool:
        """更新指定用户和测验的成绩记录

        Args:
            user_id: 用户ID
            survey_id: 测验ID
            updates: 要更新的字段 {total_score, max_score, correct_count, wrong_count}

        Returns:
            是否更新成功
        """
        try:
            rows = self.scores_sheet.get_all_values()
            headers = rows[0] if rows else []

            # 找到列索引
            col_indices = {h: i for i, h in enumerate(headers)}

            for idx, row in enumerate(rows):
                if idx == 0:  # 跳过表头
                    continue
                # user_id 在第2列(index 1), survey_id 在第3列(index 2)
                if len(row) > 2 and row[1] == user_id and row[2] == survey_id:
                    # 更新指定字段
                    if 'total_score' in updates and 'total_score' in col_indices:
                        col = col_indices['total_score']
                        self.scores_sheet.update_cell(idx + 1, col + 1, updates['total_score'])

                    if 'max_score' in updates and 'max_score' in col_indices:
                        col = col_indices['max_score']
                        self.scores_sheet.update_cell(idx + 1, col + 1, updates['max_score'])

                    if 'correct_count' in updates and 'correct_count' in col_indices:
                        col = col_indices['correct_count']
                        self.scores_sheet.update_cell(idx + 1, col + 1, updates['correct_count'])

                    if 'wrong_count' in updates and 'wrong_count' in col_indices:
                        col = col_indices['wrong_count']
                        self.scores_sheet.update_cell(idx + 1, col + 1, updates['wrong_count'])

                    self.clear_cache('leaderboard')
                    return True

            return False
        except Exception as e:
            print(f"❌ 更新成绩失败: {str(e)}")
            return False

    def get_leaderboard(self, survey_id, limit=100):
        cached = self._get_cache('leaderboard', survey_id)
        if cached: return cached
        try:
            rows = self.scores_sheet.get_all_records()
        except IndexError:
            rows = []
        survey_scores = [r for r in rows if r.get('survey_id') == survey_id]
        user_best = {}
        for s in survey_scores:
            uid = s.get('user_id')
            total = int(s.get('total_score', 0))
            dur = int(s.get('duration_seconds', 0))
            if uid not in user_best or total > int(user_best[uid].get('total_score', 0)) or \
               (total == int(user_best[uid].get('total_score', 0)) and dur < int(user_best[uid].get('duration_seconds', 0))):
                user_best[uid] = s
        sorted_scores = sorted(user_best.values(), key=lambda x: (-int(x.get('total_score', 0)), int(x.get('duration_seconds', 0))))
        try:
            users = {u.get('user_id'): u for u in self.users_sheet.get_all_records()}
        except IndexError:
            users = {}
        result = [{'rank': i+1, 'user_id': s.get('user_id'), 'name': users.get(s.get('user_id'), {}).get('name', '未知'),
                   'company': users.get(s.get('user_id'), {}).get('company', ''), 'score': int(s.get('total_score', 0)),
                   'max_score': int(s.get('max_score', 0)), 'correct_count': int(s.get('correct_count', 0)),
                   'duration_seconds': int(s.get('duration_seconds', 0))} for i, s in enumerate(sorted_scores[:limit])]
        self._set_cache('leaderboard', survey_id, result)
        return result

    def get_user_attempts(self, user_id, survey_id):
        try:
            rows = self.scores_sheet.get_all_records()
        except IndexError:
            return 0
        return len([r for r in rows if r.get('user_id') == user_id and r.get('survey_id') == survey_id])

    def get_user_best_score(self, user_id: str, survey_id: str) -> dict | None:
        """获取用户在某测验的最佳成绩

        Returns:
            {
                'total_score': int,
                'max_score': int,
                'correct_count': int,
                'wrong_count': int,
                'completed_at': str
            }
            或 None（如果没有记录）
        """
        try:
            rows = self.scores_sheet.get_all_records()
        except IndexError:
            return None

        user_scores = [r for r in rows
                       if r.get('user_id') == user_id and r.get('survey_id') == survey_id]

        if not user_scores:
            return None

        # 找最高分（同分则取最早完成的）
        best = max(user_scores, key=lambda x: (
            int(x.get('total_score', 0)),
            -len(x.get('completed_at', ''))  # 越早越好
        ))

        return {
            'total_score': int(best.get('total_score', 0)),
            'max_score': int(best.get('max_score', 0)),
            'correct_count': int(best.get('correct_count', 0)),
            'wrong_count': int(best.get('wrong_count', 0)),
            'completed_at': best.get('completed_at', '')
        }

    def get_all_scores(self) -> list:
        """获取所有成绩记录"""
        try:
            return self.scores_sheet.get_all_records()
        except IndexError:
            return []

    # User Search Methods
    def search_users(self, query, limit=20):
        """搜索用户

        Args:
            query: 搜索关键词 (匹配姓名、公司、电话)
            limit: 返回结果数量限制

        Returns:
            匹配的用户列表
        """
        try:
            rows = self.users_sheet.get_all_records()
        except IndexError:
            return []
        query_lower = query.lower()
        results = []

        for row in rows:
            name = str(row.get('name', '')).lower()
            company = str(row.get('company', '')).lower()
            phone = str(row.get('phone', '')).lower()

            if query_lower in name or query_lower in company or query_lower in phone:
                results.append({
                    'user_id': row.get('user_id'),
                    'name': row.get('name'),
                    'company': row.get('company'),
                    'phone': row.get('phone'),
                    'created_at': row.get('created_at')
                })

            if len(results) >= limit:
                break

        return results

    def get_all_users(self, limit=100, offset=0):
        """获取所有用户

        Args:
            limit: 返回结果数量限制
            offset: 跳过的记录数

        Returns:
            用户列表
        """
        try:
            rows = self.users_sheet.get_all_records()
        except IndexError:
            return []
        users = []

        for row in rows[offset:offset + limit]:
            users.append({
                'user_id': row.get('user_id'),
                'name': row.get('name'),
                'company': row.get('company'),
                'phone': row.get('phone'),
                'created_at': row.get('created_at')
            })

        return users

sheets_service = SheetsService()
