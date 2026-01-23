from flask import Blueprint, request, jsonify, send_file
from app.services import admin_service
from app.services.course_service import course_service
from app.services.excel_parser import excel_parser
from app.services.progress_service import progress_service
from app.utils import api_key_required
from io import BytesIO

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


# ==================== Survey 管理 ====================

@admin_bp.route('/surveys', methods=['GET'])
@api_key_required
def get_surveys():
    """Get all surveys"""
    try:
        surveys = admin_service.get_all_surveys()
        return jsonify({'success': True, 'data': surveys}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/surveys', methods=['POST'])
@api_key_required
def create_survey():
    """Create a new survey"""
    try:
        data = request.get_json()
        survey_id = admin_service.create_survey(
            data.get('title'),
            data.get('description', ''),
            data.get('study_content_html', ''),
            data.get('start_time'),
            data.get('end_time'),
            data.get('duration_minutes', 30),
            data.get('total_questions', 0),
            data.get('pass_score', 60),
            data.get('max_attempts', 3)
        )
        return jsonify({'success': True, 'data': {'survey_id': survey_id}}), 201
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/surveys/<survey_id>', methods=['PUT'])
@api_key_required
def update_survey(survey_id):
    """Update an existing survey"""
    try:
        data = request.get_json()
        admin_service.update_survey(
            survey_id,
            data.get('title'),
            data.get('description', ''),
            data.get('study_content_html', ''),
            data.get('start_time'),
            data.get('end_time'),
            data.get('duration_minutes', 30),
            data.get('total_questions', 0),
            data.get('pass_score', 60),
            data.get('max_attempts', 3)
        )
        return jsonify({'success': True, 'message': '更新成功'}), 200
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/surveys/<survey_id>', methods=['DELETE'])
@api_key_required
def delete_survey(survey_id):
    """Delete a survey"""
    try:
        print(f"=== 删除考卷请求 ===")
        print(f"Survey ID: {survey_id}")

        if not survey_id or survey_id == 'undefined' or survey_id == 'null':
            return jsonify({'success': False, 'message': '考卷 ID 无效'}), 400

        admin_service.delete_survey(survey_id)
        print(f"✅ 考卷删除成功: {survey_id}")
        return jsonify({'success': True, 'message': '删除成功'}), 200
    except ValueError as e:
        print(f"❌ 删除失败 (ValueError): {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        print(f"❌ 删除失败 (Exception): {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'删除失败: {str(e)}'}), 500


@admin_bp.route('/parse-excel', methods=['POST'])
@api_key_required
def parse_excel():
    """Parse an Excel file and return questions"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '请上传文件'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'success': False, 'message': '文件名无效'}), 400

        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({'success': False, 'message': '请上传 Excel 文件 (.xlsx 或 .xls)'}), 400

        questions = admin_service.parse_excel_file(file)
        return jsonify({'success': True, 'data': {'questions': questions}}), 200
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': f'解析失败: {str(e)}'}), 500


@admin_bp.route('/questions', methods=['POST'])
@api_key_required
def add_questions():
    try:
        data = request.get_json()
        count = admin_service.add_questions_to_survey(data.get('survey_id'), data.get('questions', []))
        return jsonify({'success': True, 'data': {'added_count': count}}), 201
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== 课程管理 ====================

@admin_bp.route('/courses', methods=['GET'])
@api_key_required
def get_courses():
    """获取所有课程"""
    try:
        courses = course_service.get_all_courses()
        return jsonify({'success': True, 'data': courses})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/courses', methods=['POST'])
@api_key_required
def create_course():
    """创建新课程 (上传 PDF)"""
    try:
        import json as json_module

        # 获取上传的文件
        if 'pdf' not in request.files:
            return jsonify({'success': False, 'message': '请上传 PDF 文件'}), 400

        pdf_file = request.files['pdf']
        if not pdf_file.filename.lower().endswith('.pdf'):
            return jsonify({'success': False, 'message': '文件必须是 PDF 格式'}), 400

        # 获取表单数据
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '').strip()
        quiz_survey_id = request.form.get('quiz_survey_id', '').strip() or None
        pass_score = int(request.form.get('pass_score', 60))
        icon = request.form.get('icon', '').strip() or None

        # 解析标签 (JSON 格式的字符串数组)
        tags_str = request.form.get('tags', '').strip()
        tags = json_module.loads(tags_str) if tags_str else []

        if not title:
            return jsonify({'success': False, 'message': '课程标题不能为空'}), 400

        # 读取 PDF 内容
        pdf_content = pdf_file.read()

        # 创建课程
        course = course_service.create_course(
            title=title,
            description=description,
            pdf_content=pdf_content,
            quiz_survey_id=quiz_survey_id,
            pass_score=pass_score,
            tags=tags,
            icon=icon
        )

        return jsonify({'success': True, 'data': course}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/courses/<course_id>', methods=['GET'])
@api_key_required
def get_course(course_id):
    """获取单个课程详情"""
    try:
        course = course_service.get_course(course_id)
        if not course:
            return jsonify({'success': False, 'message': '课程不存在'}), 404
        return jsonify({'success': True, 'data': course})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/courses/<course_id>', methods=['PUT'])
@api_key_required
def update_course(course_id):
    """更新课程信息"""
    try:
        data = request.get_json()
        course = course_service.update_course(course_id, data)
        if not course:
            return jsonify({'success': False, 'message': '课程不存在'}), 404
        return jsonify({'success': True, 'data': course})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/courses/<course_id>', methods=['DELETE'])
@api_key_required
def delete_course(course_id):
    """删除课程"""
    try:
        success = course_service.delete_course(course_id)
        if not success:
            return jsonify({'success': False, 'message': '课程不存在'}), 404
        return jsonify({'success': True, 'message': '课程已删除'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/courses/reorder', methods=['POST'])
@api_key_required
def reorder_courses():
    """重新排序课程"""
    try:
        data = request.get_json()
        course_ids = data.get('course_ids', [])
        success = course_service.reorder_courses(course_ids)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/courses/<course_id>/link-quiz', methods=['POST'])
@api_key_required
def link_quiz_to_course(course_id):
    """关联考卷到课程"""
    try:
        data = request.get_json()
        survey_id = data.get('survey_id')
        pass_score = data.get('pass_score', 60)

        if not survey_id:
            return jsonify({'success': False, 'message': '考卷 ID 不能为空'}), 400

        course = course_service.link_quiz(course_id, survey_id, pass_score)
        if not course:
            return jsonify({'success': False, 'message': '课程不存在'}), 404

        return jsonify({'success': True, 'data': course})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== Excel 考卷导入 ====================

@admin_bp.route('/import-quiz', methods=['POST'])
@api_key_required
def import_quiz():
    """导入 Excel 考卷"""
    try:
        # 调试信息
        print('=== import-quiz 调试 ===')
        print(f'Content-Type: {request.content_type}')
        print(f'request.files keys: {list(request.files.keys())}')
        print(f'request.form keys: {list(request.form.keys())}')

        # 获取上传的文件
        if 'excel' not in request.files:
            print('❌ 没有找到 excel 字段')
            return jsonify({'success': False, 'message': '请上传 Excel 文件'}), 400

        excel_file = request.files['excel']
        print(f'文件名: {excel_file.filename}')
        print(f'文件类型: {excel_file.content_type}')

        filename = excel_file.filename.lower()
        if not (filename.endswith('.xlsx') or filename.endswith('.xls')):
            return jsonify({'success': False, 'message': '文件必须是 Excel 格式 (.xlsx)'}), 400

        # 解析 Excel
        file_content = excel_file.read()
        print(f'文件大小: {len(file_content)} bytes')
        result = excel_parser.parse(file_content)

        if not result['success']:
            return jsonify({
                'success': False,
                'message': '解析失败',
                'errors': result['errors'],
                'summary': result['summary']
            }), 400

        return jsonify({
            'success': True,
            'data': {
                'questions': result['questions'],
                'summary': result['summary']
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/import-quiz/confirm', methods=['POST'])
@api_key_required
def confirm_import_quiz():
    """确认导入考卷到 Survey"""
    try:
        data = request.get_json()
        survey_id = data.get('survey_id')
        questions = data.get('questions', [])

        if not survey_id:
            return jsonify({'success': False, 'message': '考卷 ID 不能为空'}), 400

        if not questions:
            return jsonify({'success': False, 'message': '题目列表不能为空'}), 400

        # 添加题目到 survey
        count = admin_service.add_questions_to_survey(survey_id, questions)

        return jsonify({
            'success': True,
            'data': {
                'added_count': count,
                'survey_id': survey_id
            }
        }), 201
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/quiz-template', methods=['GET'])
@api_key_required
def download_quiz_template():
    """下载考卷 Excel 模板"""
    try:
        template_content = excel_parser.generate_template()
        return send_file(
            BytesIO(template_content),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='quiz_template.xlsx'
        )
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== 数据迁移 ====================

@admin_bp.route('/migrate/recalculate-xp', methods=['POST'])
@api_key_required
def recalculate_total_xp():
    """
    重新计算所有用户的 totalXP = sum(xpBySyllabus.values())
    清除非课程表来源的 XP（首次登录奖励、每日登录奖励等）
    """
    try:
        result = progress_service.recalculate_all_total_xp()
        return jsonify(result), 200 if result.get('success') else 500
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@admin_bp.route('/migrate/rebuild-scores-from-progress', methods=['POST'])
@api_key_required
def rebuild_scores_from_progress():
    """从 Progress.firstPassedQuizzes 重建缺失的 Scores 记录"""
    try:
        result = progress_service.rebuild_scores_from_progress()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@admin_bp.route('/migrate/fix-rebuilt-scores', methods=['POST'])
@api_key_required
def fix_rebuilt_scores():
    """
    修复之前迁移创建的错误 Scores 记录

    之前的迁移逻辑错误：max_score = len(questions) * 5 (题库总数 * 5)
    正确应为：max_score = 10 * 5 = 50 (每个测验固定抽10题)

    识别方式：attempt_number=1 且 duration_seconds=0 的记录是迁移创建的
    """
    try:
        from app.services.sheets_service import sheets_service

        # 固定参数：每次测验10题，每题5分
        QUESTIONS_PER_QUIZ = 10
        POINTS_PER_QUESTION = 5
        CORRECT_MAX_SCORE = QUESTIONS_PER_QUIZ * POINTS_PER_QUESTION  # 50

        # 直接获取 scores sheet 的原始数据和表头
        scores_sheet = sheets_service.scores_sheet
        all_rows = scores_sheet.get_all_values()

        if not all_rows:
            return jsonify({'success': True, 'fixed_count': 0, 'message': '无数据'}), 200

        headers = all_rows[0]
        col_indices = {h: i for i, h in enumerate(headers)}

        # 获取必要的列索引
        attempt_col = col_indices.get('attempt_number')
        duration_col = col_indices.get('duration_seconds')
        max_score_col = col_indices.get('max_score')
        total_score_col = col_indices.get('total_score')
        correct_col = col_indices.get('correct_count')
        wrong_col = col_indices.get('wrong_count')
        user_id_col = col_indices.get('user_id')
        survey_id_col = col_indices.get('survey_id')

        fixed_records = []
        skipped_records = []

        # 遍历所有行（跳过表头）
        for row_idx, row in enumerate(all_rows[1:], start=2):  # row_idx 是 Excel 行号
            if len(row) <= max(attempt_col or 0, duration_col or 0, max_score_col or 0):
                continue

            user_id = row[user_id_col] if user_id_col is not None and len(row) > user_id_col else ''
            survey_id = row[survey_id_col] if survey_id_col is not None and len(row) > survey_id_col else ''
            attempt_number = int(row[attempt_col] or 0) if attempt_col is not None else 0
            duration_seconds = int(row[duration_col] or 0) if duration_col is not None else 0
            current_max = int(row[max_score_col] or 0) if max_score_col is not None else 0

            # 识别迁移创建的记录：attempt_number=1 且 duration_seconds=0
            if attempt_number == 1 and duration_seconds == 0:
                # 检查是否需要修复（max_score 不等于 50）
                if current_max != CORRECT_MAX_SCORE:
                    try:
                        # 直接按行更新单元格
                        updates = []
                        if total_score_col is not None:
                            updates.append({'row': row_idx, 'col': total_score_col + 1, 'value': CORRECT_MAX_SCORE})
                        if max_score_col is not None:
                            updates.append({'row': row_idx, 'col': max_score_col + 1, 'value': CORRECT_MAX_SCORE})
                        if correct_col is not None:
                            updates.append({'row': row_idx, 'col': correct_col + 1, 'value': QUESTIONS_PER_QUIZ})
                        if wrong_col is not None:
                            updates.append({'row': row_idx, 'col': wrong_col + 1, 'value': 0})

                        for update in updates:
                            scores_sheet.update_cell(update['row'], update['col'], update['value'])

                        fixed_records.append({
                            'user_id': user_id,
                            'survey_id': survey_id,
                            'old_max': current_max,
                            'new_max': CORRECT_MAX_SCORE,
                            'row': row_idx
                        })
                    except Exception as e:
                        skipped_records.append({
                            'user_id': user_id,
                            'survey_id': survey_id,
                            'reason': f'更新失败: {str(e)}',
                            'row': row_idx
                        })
                else:
                    skipped_records.append({
                        'user_id': user_id,
                        'survey_id': survey_id,
                        'reason': 'max_score 已正确'
                    })

        # 清除缓存
        sheets_service.clear_cache('leaderboard')

        return jsonify({
            'success': True,
            'fixed_count': len(fixed_records),
            'skipped_count': len(skipped_records),
            'fixed_records': fixed_records,
            'skipped_records': skipped_records
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@admin_bp.route('/migrate/create-badges-from-progress', methods=['POST'])
@api_key_required
def create_badges_from_progress():
    """
    从 Progress.firstPassedQuizzes 为已通过测验的用户创建课程徽章

    遍历所有用户的 firstPassedQuizzes，为每个通过的测验创建徽章记录
    如果徽章已存在则跳过
    """
    try:
        from app.services.badge_service import get_badge_service
        from app.services.sheets_service import sheets_service
        import json

        badge_svc = get_badge_service()

        # 获取所有用户进度
        all_progress = progress_service._get_all_user_progress()
        print(f"📊 共找到 {len(all_progress)} 个用户进度记录")

        created_badges = []
        skipped_badges = []
        failed_badges = []

        for user_progress in all_progress:
            user_id = user_progress.get('user_id')
            if not user_id:
                continue

            # 获取用户首次通过的测验列表
            first_passed = user_progress.get('firstPassedQuizzes', [])
            if isinstance(first_passed, str):
                try:
                    first_passed = json.loads(first_passed)
                except:
                    first_passed = []

            if not first_passed:
                continue

            print(f"👤 处理用户 {user_id}，共 {len(first_passed)} 个已通过测验")

            for survey_id in first_passed:
                try:
                    # 查找该测验对应的课程
                    course_info = badge_svc.get_course_by_survey_id(survey_id)
                    if not course_info:
                        skipped_badges.append({
                            'user_id': user_id,
                            'survey_id': survey_id,
                            'reason': '未找到对应课程'
                        })
                        continue

                    # 检查是否已有徽章
                    existing = badge_svc._get_badge_by_user_course(
                        user_id, course_info['course_id']
                    )
                    if existing:
                        skipped_badges.append({
                            'user_id': user_id,
                            'survey_id': survey_id,
                            'course_id': course_info['course_id'],
                            'reason': '徽章已存在'
                        })
                        continue

                    # 从 Scores 表获取最佳分数
                    best_score = sheets_service.get_user_best_score(user_id, survey_id)
                    if best_score:
                        score = best_score['total_score']
                        max_score = best_score['max_score']
                        percentage = round(score / max_score * 100) if max_score > 0 else 0
                    else:
                        # 如果没有分数记录，使用默认值（通过即满分）
                        score = 50
                        max_score = 50
                        percentage = 100

                    # 创建徽章
                    result = badge_svc.issue_or_update_badge(
                        user_id=user_id,
                        course_id=course_info['course_id'],
                        course_title=course_info['course_title'],
                        survey_id=survey_id,
                        score=score,
                        max_score=max_score,
                        percentage=percentage
                    )

                    if result.get('success'):
                        created_badges.append({
                            'user_id': user_id,
                            'course_id': course_info['course_id'],
                            'course_title': course_info['course_title'],
                            'score': score,
                            'max_score': max_score
                        })
                    else:
                        failed_badges.append({
                            'user_id': user_id,
                            'survey_id': survey_id,
                            'reason': result.get('message', '创建失败')
                        })

                except Exception as e:
                    failed_badges.append({
                        'user_id': user_id,
                        'survey_id': survey_id,
                        'reason': str(e)
                    })

        return jsonify({
            'success': True,
            'created_count': len(created_badges),
            'skipped_count': len(skipped_badges),
            'failed_count': len(failed_badges),
            'created_badges': created_badges,
            'skipped_badges': skipped_badges,
            'failed_badges': failed_badges
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
