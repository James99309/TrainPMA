"""
培训证书服务
管理培训证书的颁发、存储和查询
"""
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import uuid
import json
import os
import threading


class CertificateService:
    """证书管理服务 - 管理 Certificates Sheet"""

    _instance = None
    _lock = threading.Lock()

    # Certificates Sheet 列结构
    COLUMNS = [
        'certificate_id',
        'user_id',
        'user_name',
        'user_company',
        'syllabus_id',
        'syllabus_name',
        'score',
        'max_score',
        'percentage',          # 百分比评分
        'xp_earned',           # XP 经验值
        'rank',
        'total_participants',
        'course_scores',       # JSON object - {"course_id": {"name": "...", "score": 50, "max_score": 50, "percentage": 100, "xp_earned": 150}, ...}
        'issued_at',
        'issued_by'
    ]

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(CertificateService, cls).__new__(cls)
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

            # 获取或创建 Certificates sheet
            self._ensure_certificates_sheet()

            self._initialized = True
            print("✅ CertificateService 初始化成功")
        except Exception as e:
            print(f"❌ CertificateService 初始化失败: {str(e)}")
            raise

    def _ensure_certificates_sheet(self):
        """确保 Certificates sheet 存在且表头完整"""
        try:
            self.certificates_sheet = self.spreadsheet.worksheet('Certificates')
            print("✅ Certificates sheet 已存在")

            # 检查并修复表头
            self._fix_headers_if_needed()

        except gspread.exceptions.WorksheetNotFound:
            print("⚠️ Certificates sheet 不存在，正在创建...")
            self.certificates_sheet = self.spreadsheet.add_worksheet(
                title='Certificates',
                rows=1000,
                cols=len(self.COLUMNS)
            )
            # 添加表头
            self.certificates_sheet.append_row(self.COLUMNS)
            print("✅ Certificates sheet 创建成功")

    def _fix_headers_if_needed(self):
        """检查并修复缺失的表头"""
        try:
            current_headers = self.certificates_sheet.row_values(1)
            expected_headers = self.COLUMNS

            if current_headers == expected_headers:
                print("✅ 证书表头完整")
                return

            print(f"⚠️ 证书表头不完整，当前 {len(current_headers)} 列，期望 {len(expected_headers)} 列")

            # 直接覆盖第一行为正确的表头
            self.certificates_sheet.update('A1', [expected_headers])
            print("✅ 证书表头已修复")

        except Exception as e:
            print(f"❌ 检查/修复证书表头失败: {str(e)}")

    def issue_certificates_for_syllabus(
        self,
        syllabus_id: str,
        issued_by: str = 'admin'
    ) -> dict:
        """
        为课程表的所有参与者颁发证书

        Args:
            syllabus_id: 课程表ID
            issued_by: 颁发者

        Returns:
            {
                'success': True,
                'certificates_issued': int,
                'certificates': [...]
            }
        """
        try:
            from app.services.syllabus_service import syllabus_service
            from app.services.progress_service import progress_service

            # 获取课程表信息
            syllabus = syllabus_service.get_syllabus(syllabus_id)
            if not syllabus:
                return {'success': False, 'message': '课程表不存在'}

            syllabus_name = syllabus.get('name', '未知课程表')

            # 获取所有用户进度
            all_progress = progress_service._get_all_user_progress()

            # 获取课程表中所有课程的测验信息
            course_quizzes = self._get_syllabus_course_quizzes(syllabus)
            if not course_quizzes:
                return {'success': False, 'message': '课程表中没有测验'}

            # 批量预加载分数和问题数据（减少 API 调用次数）
            from app.services.sheets_service import sheets_service
            print("📊 预加载分数和问题数据...")
            all_scores = sheets_service.scores_sheet.get_all_records()
            survey_ids = list(set(q['survey_id'] for q in course_quizzes))
            all_questions = {
                sid: sheets_service.get_questions_by_survey(sid)
                for sid in survey_ids
            }
            print(f"✅ 预加载完成: {len(all_scores)} 条分数记录, {len(survey_ids)} 个测验问题")

            # 过滤通过所有测验的用户
            participants = []
            not_passed_count = 0
            for p in all_progress:
                xp_by_syllabus = p.get('xpBySyllabus', {})
                syllabus_xp = xp_by_syllabus.get(syllabus_id, 0)
                if syllabus_xp > 0:
                    user_id = p.get('user_id')
                    # 检查是否通过所有测验（传入用户进度数据）
                    passed_all, failed_courses = self._check_user_passed_all_quizzes(
                        user_id, course_quizzes, user_progress=p
                    )
                    if passed_all:
                        # 计算实际测验分数（使用预加载数据）
                        user_quiz_scores = self._calculate_user_quiz_total(user_id, course_quizzes, all_scores)
                        participants.append({
                            'user_id': user_id,
                            'score': user_quiz_scores['total_score'],      # 实际得分
                            'max_score': user_quiz_scores['max_score'],    # 满分
                            'xp_earned': syllabus_xp,                      # XP 经验值
                            'user_progress': p  # 保存完整的用户进度数据
                        })
                    else:
                        not_passed_count += 1
                        print(f"⏭️ 用户 {user_id} 未通过所有测验，跳过: {failed_courses}")

            if not participants:
                return {
                    'success': False,
                    'message': '没有通过所有测验的参与者',
                    'not_passed': not_passed_count
                }

            # 按分数排序
            participants.sort(key=lambda x: x['score'], reverse=True)
            total_participants = len(participants)

            # 获取用户信息映射
            user_map = progress_service._get_user_map()

            # 获取课程详情用于记录各课程得分
            course_details = self._get_course_details_for_syllabus(syllabus)

            # 删除该课程表的所有旧证书（重新颁发会更新排名和分数）
            deleted_count = self._delete_certificates_for_syllabus(syllabus_id)
            if deleted_count > 0:
                print(f"🗑️ 已删除 {deleted_count} 张旧证书")

            # 颁发证书
            certificates = []
            now = datetime.now().isoformat()

            for rank, participant in enumerate(participants, 1):
                user_id = participant['user_id']

                user_name = user_map.get(user_id, '未知用户')
                user_company = self._get_user_company(user_id)

                # 获取用户在各课程的得分（使用预加载数据）
                user_progress = participant.get('user_progress', {})
                course_scores = self._get_user_course_scores(
                    user_id, syllabus, course_details, user_progress,
                    all_scores, all_questions
                )

                # 计算百分比
                percentage = 0
                if participant['max_score'] > 0:
                    percentage = round(participant['score'] / participant['max_score'] * 100)

                certificate = {
                    'certificate_id': f"cert-{uuid.uuid4().hex[:8]}",
                    'user_id': user_id,
                    'user_name': user_name,
                    'user_company': user_company,
                    'syllabus_id': syllabus_id,
                    'syllabus_name': syllabus_name,
                    'score': participant['score'],           # 实际得分
                    'max_score': participant['max_score'],   # 满分
                    'percentage': percentage,                # 百分比评分
                    'xp_earned': participant['xp_earned'],   # XP 经验值
                    'rank': rank,
                    'total_participants': total_participants,
                    'course_scores': course_scores,
                    'issued_at': now,
                    'issued_by': issued_by
                }

                # 保存到 Sheet
                self._save_certificate(certificate)
                certificates.append(certificate)

            return {
                'success': True,
                'certificates_issued': len(certificates),
                'total_participants': total_participants,
                'deleted_old': deleted_count,
                'not_passed': not_passed_count,
                'certificates': certificates
            }

        except Exception as e:
            print(f"❌ 颁发证书失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'message': str(e)}

    def _save_certificate(self, certificate: dict):
        """保存证书到 Sheet"""
        row = [
            certificate.get('certificate_id', ''),
            certificate.get('user_id', ''),
            certificate.get('user_name', ''),
            certificate.get('user_company', ''),
            certificate.get('syllabus_id', ''),
            certificate.get('syllabus_name', ''),
            certificate.get('score', 0),
            certificate.get('max_score', 0),
            certificate.get('percentage', 0),      # 百分比评分
            certificate.get('xp_earned', 0),       # XP 经验值
            certificate.get('rank', 0),
            certificate.get('total_participants', 0),
            json.dumps(certificate.get('course_scores', {}), ensure_ascii=False),
            certificate.get('issued_at', ''),
            certificate.get('issued_by', '')
        ]
        self.certificates_sheet.append_row(row)

    def _get_existing_certificates_for_syllabus(self, syllabus_id: str) -> list:
        """获取课程表已颁发的证书"""
        try:
            all_values = self.certificates_sheet.get_all_values()
            if len(all_values) <= 1:
                return []

            headers = all_values[0]
            syllabus_id_col = headers.index('syllabus_id') if 'syllabus_id' in headers else 4

            certificates = []
            for row in all_values[1:]:
                if len(row) > syllabus_id_col and row[syllabus_id_col] == syllabus_id:
                    cert = {}
                    for i, header in enumerate(headers):
                        cert[header] = row[i] if i < len(row) else ''
                    certificates.append(cert)

            return certificates
        except Exception:
            return []

    def _delete_certificates_for_syllabus(self, syllabus_id: str) -> int:
        """删除课程表的所有证书"""
        try:
            all_values = self.certificates_sheet.get_all_values()
            if len(all_values) <= 1:
                return 0

            headers = all_values[0]
            syllabus_id_col = headers.index('syllabus_id') if 'syllabus_id' in headers else 4

            # 找出要删除的行（从后往前删除以保持索引正确）
            rows_to_delete = []
            for idx, row in enumerate(all_values[1:], start=2):  # idx 是 Excel 行号
                if len(row) > syllabus_id_col and row[syllabus_id_col] == syllabus_id:
                    rows_to_delete.append(idx)

            # 从后往前删除
            deleted = 0
            for row_idx in reversed(rows_to_delete):
                self.certificates_sheet.delete_rows(row_idx)
                deleted += 1

            return deleted
        except Exception as e:
            print(f"❌ 删除证书失败: {str(e)}")
            return 0

    def _get_course_details_for_syllabus(self, syllabus: dict) -> dict:
        """获取课程表中的课程详情"""
        from app.services.course_service import course_service

        course_details = {}
        course_sequence = syllabus.get('course_sequence', [])

        for item in course_sequence:
            course_id = item.get('course_id')
            course = course_service.get_course(course_id)
            if course:
                course_details[course_id] = {
                    'title': course.get('title', '未知课程'),
                    'survey_id': course.get('quiz', {}).get('survey_id')
                }

        return course_details

    def _get_syllabus_course_quizzes(self, syllabus: dict) -> list:
        """
        获取课程表中所有课程的测验信息

        Returns:
            [
                {
                    'course_id': 'xxx',
                    'course_title': '课程名称',
                    'survey_id': 'survey-xxx',
                    'pass_score': 60  # 通过百分比
                },
                ...
            ]
        """
        from app.services.course_service import course_service

        course_quizzes = []
        course_sequence = syllabus.get('course_sequence', [])

        for item in course_sequence:
            course_id = item.get('course_id')
            course = course_service.get_course(course_id)
            if course and course.get('quiz'):
                quiz = course['quiz']
                survey_id = quiz.get('survey_id')
                if survey_id:
                    course_quizzes.append({
                        'course_id': course_id,
                        'course_title': course.get('title', '未知课程'),
                        'survey_id': survey_id,
                        'pass_score': quiz.get('pass_score', 60)  # 默认 60%
                    })

        return course_quizzes

    def _check_user_passed_all_quizzes(self, user_id: str, course_quizzes: list, user_progress: dict = None) -> tuple:
        """
        检查用户是否通过所有测验

        Args:
            user_id: 用户ID
            course_quizzes: 课程测验列表
            user_progress: 用户进度数据（可选，包含 first_passed_quizzes）

        Returns:
            (passed_all: bool, failed_courses: list)
        """
        failed_courses = []

        # 从用户进度获取已通过的测验列表（字段名是 camelCase: firstPassedQuizzes）
        passed_quizzes = set()
        if user_progress:
            first_passed = user_progress.get('firstPassedQuizzes', [])
            if isinstance(first_passed, str):
                try:
                    import json
                    first_passed = json.loads(first_passed)
                except:
                    first_passed = []
            passed_quizzes = set(first_passed) if first_passed else set()

        print(f"📋 检查用户 {user_id} 的测验通过情况，共 {len(course_quizzes)} 个测验")
        print(f"  📝 用户已通过的测验: {passed_quizzes}")

        for quiz_info in course_quizzes:
            survey_id = quiz_info['survey_id']
            course_title = quiz_info['course_title']

            print(f"  🔍 检查课程 [{course_title}] survey_id={survey_id}")

            if survey_id in passed_quizzes:
                print(f"  ✅ 已通过（在 first_passed_quizzes 中）")
            else:
                print(f"  ❌ 未通过（不在 first_passed_quizzes 中）")
                failed_courses.append(f"{course_title}(未通过)")

        passed_all = len(failed_courses) == 0
        return passed_all, failed_courses

    def _get_best_score_from_cache(self, user_id: str, survey_id: str, all_scores: list) -> dict | None:
        """从预加载的分数数据中获取用户最佳成绩"""
        user_scores = [
            s for s in all_scores
            if s.get('user_id') == user_id and s.get('survey_id') == survey_id
        ]
        if not user_scores:
            return None
        return max(user_scores, key=lambda x: x.get('total_score', 0))

    def _calculate_user_quiz_total(self, user_id: str, course_quizzes: list, all_scores: list) -> dict:
        """计算用户在所有测验的总分（使用预加载数据）"""
        total_score = 0
        max_score = 0

        for quiz_info in course_quizzes:
            survey_id = quiz_info['survey_id']
            best = self._get_best_score_from_cache(user_id, survey_id, all_scores)
            if best:
                total_score += best.get('total_score', 0)
                max_score += best.get('max_score', 0)

        return {'total_score': total_score, 'max_score': max_score}

    def _get_user_course_scores(
        self, user_id: str, syllabus: dict, course_details: dict,
        user_progress: dict = None, all_scores: list = None, all_questions: dict = None
    ) -> dict:
        """获取用户在课程表各课程的实际测验分数、百分比和 XP（使用预加载数据）"""
        course_scores = {}
        course_sequence = syllabus.get('course_sequence', [])

        # 获取用户已完成的课程列表
        completed_courses = set()
        passed_quizzes = set()
        if user_progress:
            courses_completed = user_progress.get('coursesCompleted', [])
            if isinstance(courses_completed, str):
                try:
                    courses_completed = json.loads(courses_completed)
                except:
                    courses_completed = []
            if isinstance(courses_completed, list):
                completed_courses = set(courses_completed)

            first_passed = user_progress.get('firstPassedQuizzes', [])
            if isinstance(first_passed, str):
                try:
                    first_passed = json.loads(first_passed)
                except:
                    first_passed = []
            if isinstance(first_passed, list):
                passed_quizzes = set(first_passed)

        for item in course_sequence:
            course_id = item.get('course_id')
            if course_id not in course_details:
                continue

            course_info = course_details[course_id]
            survey_id = course_info.get('survey_id')
            course_title = course_info.get('title', '未知课程')

            score_data = {
                'name': course_title,
                'score': 0,
                'max_score': 0,
                'percentage': 0,
                'xp_earned': 0
            }

            # 计算 XP
            xp = 0
            if course_id in completed_courses:
                xp += 50  # 阅读完成 +50 XP

            if survey_id:
                # 从预加载数据获取实际测验分数
                best_score = self._get_best_score_from_cache(user_id, survey_id, all_scores)
                if best_score:
                    score_data['score'] = best_score.get('total_score', 0)
                    score_data['max_score'] = best_score.get('max_score', 0)
                    if score_data['max_score'] > 0:
                        score_data['percentage'] = round(
                            score_data['score'] / score_data['max_score'] * 100
                        )

                # 通过测验的 XP
                if survey_id in passed_quizzes:
                    questions = all_questions.get(survey_id, []) if all_questions else []
                    xp += len(questions) * 10

            score_data['xp_earned'] = xp
            course_scores[course_id] = score_data

        return course_scores

    def _get_user_company(self, user_id: str) -> str:
        """获取用户公司"""
        try:
            if user_id.startswith('emp_'):
                # 员工用户
                from app.services.pma_api_service import get_employee_by_id
                emp_id = user_id[4:]  # 去掉 emp_ 前缀
                emp = get_employee_by_id(emp_id)
                if emp:
                    return emp.get('company', '') or emp.get('department', '') or 'SP8D'
            else:
                # 客人用户
                from app.services.sheets_service import sheets_service
                user = sheets_service.get_user_by_id(user_id)
                if user:
                    return user.get('company', '')
        except Exception:
            pass
        return ''

    def get_user_certificates(self, user_id: str) -> list:
        """
        获取用户的所有证书

        Args:
            user_id: 用户ID

        Returns:
            证书列表
        """
        try:
            all_values = self.certificates_sheet.get_all_values()
            if len(all_values) <= 1:
                return []

            headers = all_values[0]
            user_id_col = headers.index('user_id') if 'user_id' in headers else 1

            certificates = []
            for row in all_values[1:]:
                if len(row) > user_id_col and row[user_id_col] == user_id:
                    cert = self._row_to_certificate(row, headers)
                    certificates.append(cert)

            # 按颁发时间倒序
            certificates.sort(key=lambda x: x.get('issued_at', ''), reverse=True)
            return certificates

        except Exception as e:
            print(f"❌ 获取用户证书失败: {str(e)}")
            return []

    def get_certificate_by_id(self, certificate_id: str) -> dict | None:
        """
        获取单个证书详情

        Args:
            certificate_id: 证书ID

        Returns:
            证书详情，不存在返回 None
        """
        try:
            all_values = self.certificates_sheet.get_all_values()
            if len(all_values) <= 1:
                return None

            headers = all_values[0]
            cert_id_col = headers.index('certificate_id') if 'certificate_id' in headers else 0

            for row in all_values[1:]:
                if len(row) > cert_id_col and row[cert_id_col] == certificate_id:
                    return self._row_to_certificate(row, headers)

            return None

        except Exception as e:
            print(f"❌ 获取证书详情失败: {str(e)}")
            return None

    def _row_to_certificate(self, row: list, headers: list) -> dict:
        """将行数据转换为证书字典"""
        cert = {}
        for i, header in enumerate(headers):
            value = row[i] if i < len(row) else ''

            # 解析 JSON 字段
            if header == 'course_scores':
                try:
                    cert[header] = json.loads(value) if value else {}
                except:
                    cert[header] = {}
            # 数值字段
            elif header in ['score', 'max_score', 'percentage', 'xp_earned', 'rank', 'total_participants']:
                try:
                    cert[header] = int(value) if value else 0
                except:
                    cert[header] = 0
            else:
                cert[header] = value

        return cert

    def get_syllabus_certificate_stats(self, syllabus_id: str) -> dict:
        """
        获取课程表证书统计信息

        Args:
            syllabus_id: 课程表ID

        Returns:
            统计信息
        """
        existing_certs = self._get_existing_certificates_for_syllabus(syllabus_id)

        return {
            'total_certificates': len(existing_certs),
            'certificates': existing_certs
        }


# 单例实例
certificate_service = CertificateService()
