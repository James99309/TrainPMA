#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Sheets + JSON → PostgreSQL 数据迁移脚本

在 Mac 上运行（需要能访问 Google Sheets）：
  cd backend
  python scripts/migrate_sheets_to_postgres.py

前提条件：
  1. Google credentials 文件就绪 (credentials/service-account.json)
  2. PostgreSQL 可达（本地或通过 SSH tunnel）
  3. pip install gspread oauth2client psycopg2-binary flask-sqlalchemy
  4. 设置环境变量 DATABASE_URL 或使用默认值
"""
import sys
import os
import json
import uuid
from datetime import datetime

# 路径修正 - 支持从 backend/ 或 backend/scripts/ 运行
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

import gspread
from oauth2client.service_account import ServiceAccountCredentials


def connect_sheets():
    """连接到 Google Sheets"""
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    creds_file = os.getenv('GOOGLE_CREDENTIALS_FILE', 'credentials/service-account.json')
    if not os.path.isabs(creds_file):
        creds_file = os.path.join(backend_dir, creds_file)

    creds = ServiceAccountCredentials.from_json_keyfile_name(creds_file, scope)
    client = gspread.authorize(creds)
    sheets_id = os.getenv('GOOGLE_SHEETS_ID')
    if not sheets_id:
        print("❌ GOOGLE_SHEETS_ID 环境变量未设置")
        sys.exit(1)
    return client.open_by_key(sheets_id)


def safe_int(val, default=0):
    if val is None or val == '':
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def safe_bool(val, default=False):
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().upper() == 'TRUE'
    return default


def safe_datetime(val):
    if not val:
        return None
    try:
        return datetime.fromisoformat(str(val))
    except (ValueError, TypeError):
        return None


def get_sheet_data(spreadsheet, sheet_name):
    """安全获取工作表数据"""
    try:
        ws = spreadsheet.worksheet(sheet_name)
        records = ws.get_all_records()
        return records
    except gspread.exceptions.WorksheetNotFound:
        print(f"  ⚠️ 工作表 '{sheet_name}' 不存在，跳过")
        return []
    except IndexError:
        print(f"  ⚠️ 工作表 '{sheet_name}' 为空")
        return []


def migrate_users(spreadsheet, db, User):
    print("\n📋 迁移 Users...")
    rows = get_sheet_data(spreadsheet, 'Users')
    count = 0
    for row in rows:
        user_id = row.get('user_id')
        if not user_id:
            continue
        existing = db.session.get(User, user_id)
        if existing:
            existing.name = row.get('name', '')
            existing.company = row.get('company', '')
            existing.phone = str(row.get('phone', ''))
            existing.updated_at = safe_datetime(row.get('updated_at')) or datetime.utcnow()
        else:
            db.session.add(User(
                user_id=user_id,
                name=row.get('name', ''),
                company=row.get('company', ''),
                phone=str(row.get('phone', '')),
                created_at=safe_datetime(row.get('created_at')) or datetime.utcnow(),
                updated_at=safe_datetime(row.get('updated_at')) or datetime.utcnow(),
            ))
        count += 1
    db.session.commit()
    print(f"  ✅ Users: {count} 条记录")
    return count


def migrate_surveys(spreadsheet, db, Survey):
    print("\n📋 迁移 Surveys...")
    rows = get_sheet_data(spreadsheet, 'Surveys')
    count = 0
    for row in rows:
        survey_id = row.get('survey_id')
        if not survey_id:
            continue
        existing = db.session.get(Survey, survey_id)
        if existing:
            existing.title = row.get('title', '')
            existing.description = row.get('description', '')
            existing.study_content_html = row.get('study_content_html', '')
            existing.start_time = safe_datetime(row.get('start_time'))
            existing.end_time = safe_datetime(row.get('end_time'))
            existing.duration_minutes = safe_int(row.get('duration_minutes'))
            existing.total_questions = safe_int(row.get('total_questions'))
            existing.pass_score = safe_int(row.get('pass_score'), 60)
            existing.max_attempts = safe_int(row.get('max_attempts'), 3)
            existing.is_active = safe_bool(row.get('is_active'), True)
        else:
            db.session.add(Survey(
                survey_id=survey_id,
                title=row.get('title', ''),
                description=row.get('description', ''),
                study_content_html=row.get('study_content_html', ''),
                start_time=safe_datetime(row.get('start_time')),
                end_time=safe_datetime(row.get('end_time')),
                duration_minutes=safe_int(row.get('duration_minutes')),
                total_questions=safe_int(row.get('total_questions')),
                pass_score=safe_int(row.get('pass_score'), 60),
                max_attempts=safe_int(row.get('max_attempts'), 3),
                is_active=safe_bool(row.get('is_active'), True),
                created_at=safe_datetime(row.get('created_at')) or datetime.utcnow(),
            ))
        count += 1
    db.session.commit()
    print(f"  ✅ Surveys: {count} 条记录")
    return count


def migrate_questions(spreadsheet, db, Question):
    print("\n📋 迁移 Questions...")
    rows = get_sheet_data(spreadsheet, 'Questions')
    count = 0
    for row in rows:
        question_id = row.get('question_id')
        if not question_id:
            continue
        # Ensure options_json is a string
        options_json = row.get('options_json', '[]')
        if not isinstance(options_json, str):
            options_json = json.dumps(options_json, ensure_ascii=False)

        existing = db.session.get(Question, question_id)
        if existing:
            existing.survey_id = row.get('survey_id', '')
            existing.question_type = row.get('question_type', '')
            existing.question_text = row.get('question_text', '')
            existing.options_json = options_json
            existing.correct_answer = str(row.get('correct_answer', ''))
            existing.score = safe_int(row.get('score'), 5)
            existing.explanation = row.get('explanation', '')
            existing.order_index = safe_int(row.get('order_index'))
        else:
            db.session.add(Question(
                question_id=question_id,
                survey_id=row.get('survey_id', ''),
                question_type=row.get('question_type', ''),
                question_text=row.get('question_text', ''),
                options_json=options_json,
                correct_answer=str(row.get('correct_answer', '')),
                score=safe_int(row.get('score'), 5),
                explanation=row.get('explanation', ''),
                order_index=safe_int(row.get('order_index')),
            ))
        count += 1
    db.session.commit()
    print(f"  ✅ Questions: {count} 条记录")
    return count


def migrate_responses(spreadsheet, db, Response):
    print("\n📋 迁移 Responses...")
    rows = get_sheet_data(spreadsheet, 'Responses')
    count = 0
    batch = []
    for row in rows:
        response_id = row.get('response_id')
        if not response_id:
            continue
        batch.append(Response(
            response_id=response_id,
            user_id=row.get('user_id', ''),
            survey_id=row.get('survey_id', ''),
            question_id=row.get('question_id', ''),
            user_answer=str(row.get('user_answer', '')),
            is_correct=safe_bool(row.get('is_correct')),
            score_earned=safe_int(row.get('score_earned')),
            attempt=safe_int(row.get('attempt'), 1),
            time_spent_seconds=safe_int(row.get('time_spent_seconds')),
            submitted_at=safe_datetime(row.get('submitted_at')) or datetime.utcnow(),
        ))
        count += 1
        if len(batch) >= 500:
            db.session.bulk_save_objects(batch)
            db.session.commit()
            batch = []
    if batch:
        db.session.bulk_save_objects(batch)
        db.session.commit()
    print(f"  ✅ Responses: {count} 条记录")
    return count


def migrate_scores(spreadsheet, db, Score):
    print("\n📋 迁移 Scores...")
    rows = get_sheet_data(spreadsheet, 'Scores')
    count = 0
    for row in rows:
        score_id = row.get('score_id')
        if not score_id:
            continue
        existing = db.session.get(Score, score_id)
        if existing:
            continue  # Scores are append-only
        db.session.add(Score(
            score_id=score_id,
            user_id=row.get('user_id', ''),
            survey_id=row.get('survey_id', ''),
            attempt_number=safe_int(row.get('attempt_number'), 1),
            total_score=safe_int(row.get('total_score')),
            max_score=safe_int(row.get('max_score')),
            correct_count=safe_int(row.get('correct_count')),
            wrong_count=safe_int(row.get('wrong_count')),
            retry_count=safe_int(row.get('retry_count')),
            completed_at=safe_datetime(row.get('completed_at')) or datetime.utcnow(),
            duration_seconds=safe_int(row.get('duration_seconds')),
        ))
        count += 1
    db.session.commit()
    print(f"  ✅ Scores: {count} 条记录")
    return count


def migrate_user_progress(spreadsheet, db, UserProgress):
    print("\n📋 迁移 UserProgress...")
    try:
        ws = spreadsheet.worksheet('UserProgress')
        all_values = ws.get_all_values()
    except gspread.exceptions.WorksheetNotFound:
        print("  ⚠️ UserProgress 工作表不存在")
        return 0

    if len(all_values) <= 1:
        print("  ⚠️ UserProgress 为空")
        return 0

    headers = all_values[0]
    count = 0
    for row_data in all_values[1:]:
        row = {}
        for i, header in enumerate(headers):
            row[header] = row_data[i] if i < len(row_data) else ''

        user_id = row.get('user_id', '')
        if not user_id:
            continue

        progress_id = row.get('progress_id', '') or str(uuid.uuid4())

        existing = UserProgress.query.filter_by(user_id=user_id).first()
        if existing:
            # Update
            existing.streak = safe_int(row.get('streak'))
            existing.total_xp = safe_int(row.get('total_xp'))
            existing.hearts = safe_int(row.get('hearts'), 5)
            existing.max_hearts = safe_int(row.get('max_hearts'), 5)
            existing.daily_goal_minutes = safe_int(row.get('daily_goal_minutes'), 10)
            existing.current_chapter = safe_int(row.get('current_chapter'), 1)
            existing.current_section = safe_int(row.get('current_section'))
            existing.chapters_completed = row.get('chapters_completed', '[]') or '[]'
            existing.achievements = row.get('achievements', '[]') or '[]'
            existing.words_learned = row.get('words_learned', '[]') or '[]'
            existing.total_reading_time = safe_int(row.get('total_reading_time'))
            existing.onboarding_completed = safe_bool(row.get('onboarding_completed'))
            existing.last_read_date = row.get('last_read_date', '')
            existing.courses_completed = row.get('courses_completed', '[]') or '[]'
            existing.quizzes_passed = safe_int(row.get('quizzes_passed'))
            existing.quiz_streak = safe_int(row.get('quiz_streak'))
            existing.last_login_reward_date = row.get('last_login_reward_date', '')
            existing.first_passed_quizzes = row.get('first_passed_quizzes', '[]') or '[]'
            existing.wrong_questions = row.get('wrong_questions', '[]') or '[]'
            existing.xp_by_syllabus = row.get('xp_by_syllabus', '{}') or '{}'
            existing.first_login_reward_claimed = safe_bool(row.get('first_login_reward_claimed'))
            existing.updated_at = safe_datetime(row.get('updated_at')) or datetime.utcnow()
        else:
            db.session.add(UserProgress(
                progress_id=progress_id,
                user_id=user_id,
                streak=safe_int(row.get('streak')),
                total_xp=safe_int(row.get('total_xp')),
                hearts=safe_int(row.get('hearts'), 5),
                max_hearts=safe_int(row.get('max_hearts'), 5),
                daily_goal_minutes=safe_int(row.get('daily_goal_minutes'), 10),
                current_chapter=safe_int(row.get('current_chapter'), 1),
                current_section=safe_int(row.get('current_section')),
                chapters_completed=row.get('chapters_completed', '[]') or '[]',
                achievements=row.get('achievements', '[]') or '[]',
                words_learned=row.get('words_learned', '[]') or '[]',
                total_reading_time=safe_int(row.get('total_reading_time')),
                onboarding_completed=safe_bool(row.get('onboarding_completed')),
                last_read_date=row.get('last_read_date', ''),
                courses_completed=row.get('courses_completed', '[]') or '[]',
                quizzes_passed=safe_int(row.get('quizzes_passed')),
                quiz_streak=safe_int(row.get('quiz_streak')),
                last_login_reward_date=row.get('last_login_reward_date', ''),
                first_passed_quizzes=row.get('first_passed_quizzes', '[]') or '[]',
                wrong_questions=row.get('wrong_questions', '[]') or '[]',
                xp_by_syllabus=row.get('xp_by_syllabus', '{}') or '{}',
                first_login_reward_claimed=safe_bool(row.get('first_login_reward_claimed')),
                updated_at=safe_datetime(row.get('updated_at')) or datetime.utcnow(),
            ))
        count += 1
    db.session.commit()
    print(f"  ✅ UserProgress: {count} 条记录")
    return count


def migrate_certificates(spreadsheet, db, Certificate):
    print("\n📋 迁移 Certificates...")
    try:
        ws = spreadsheet.worksheet('Certificates')
        all_values = ws.get_all_values()
    except gspread.exceptions.WorksheetNotFound:
        print("  ⚠️ Certificates 工作表不存在")
        return 0

    if len(all_values) <= 1:
        print("  ⚠️ Certificates 为空")
        return 0

    headers = all_values[0]
    count = 0
    for row_data in all_values[1:]:
        row = {}
        for i, header in enumerate(headers):
            row[header] = row_data[i] if i < len(row_data) else ''

        cert_id = row.get('certificate_id', '')
        if not cert_id:
            continue

        existing = db.session.get(Certificate, cert_id)
        if existing:
            continue  # Certificates are re-issued by deleting first
        db.session.add(Certificate(
            certificate_id=cert_id,
            user_id=row.get('user_id', ''),
            user_name=row.get('user_name', ''),
            user_company=row.get('user_company', ''),
            syllabus_id=row.get('syllabus_id', ''),
            syllabus_name=row.get('syllabus_name', ''),
            score=safe_int(row.get('score')),
            max_score=safe_int(row.get('max_score')),
            percentage=safe_int(row.get('percentage')),
            xp_earned=safe_int(row.get('xp_earned')),
            rank=safe_int(row.get('rank')),
            total_participants=safe_int(row.get('total_participants')),
            course_scores=row.get('course_scores', '{}') or '{}',
            issued_at=safe_datetime(row.get('issued_at')) or datetime.utcnow(),
            issued_by=row.get('issued_by', 'admin'),
        ))
        count += 1
    db.session.commit()
    print(f"  ✅ Certificates: {count} 条记录")
    return count


def migrate_course_badges(spreadsheet, db, CourseBadge):
    print("\n📋 迁移 CourseBadges...")
    try:
        ws = spreadsheet.worksheet('CourseBadges')
        all_values = ws.get_all_values()
    except gspread.exceptions.WorksheetNotFound:
        print("  ⚠️ CourseBadges 工作表不存在")
        return 0

    if len(all_values) <= 1:
        print("  ⚠️ CourseBadges 为空")
        return 0

    headers = all_values[0]
    count = 0
    for row_data in all_values[1:]:
        row = {}
        for i, header in enumerate(headers):
            row[header] = row_data[i] if i < len(row_data) else ''

        badge_id = row.get('badge_id', '')
        if not badge_id:
            continue

        existing = db.session.get(CourseBadge, badge_id)
        if existing:
            existing.score = safe_int(row.get('score'))
            existing.max_score = safe_int(row.get('max_score'))
            existing.percentage = safe_int(row.get('percentage'))
            existing.attempt_count = safe_int(row.get('attempt_count'), 1)
            existing.last_updated_at = safe_datetime(row.get('last_updated_at')) or datetime.utcnow()
        else:
            db.session.add(CourseBadge(
                badge_id=badge_id,
                user_id=row.get('user_id', ''),
                user_name=row.get('user_name', ''),
                course_id=row.get('course_id', ''),
                course_title=row.get('course_title', ''),
                survey_id=row.get('survey_id', ''),
                score=safe_int(row.get('score')),
                max_score=safe_int(row.get('max_score')),
                percentage=safe_int(row.get('percentage')),
                attempt_count=safe_int(row.get('attempt_count'), 1),
                first_passed_at=safe_datetime(row.get('first_passed_at')) or datetime.utcnow(),
                last_updated_at=safe_datetime(row.get('last_updated_at')) or datetime.utcnow(),
            ))
        count += 1
    db.session.commit()
    print(f"  ✅ CourseBadges: {count} 条记录")
    return count


def migrate_user_groups(spreadsheet, db, UserGroup):
    print("\n📋 迁移 UserGroups...")
    rows = get_sheet_data(spreadsheet, 'UserGroups')
    count = 0
    for row in rows:
        group_id = row.get('group_id', '')
        if not group_id:
            continue

        member_ids_raw = row.get('member_ids', '[]')
        if isinstance(member_ids_raw, str):
            member_ids = member_ids_raw
        else:
            member_ids = json.dumps(member_ids_raw, ensure_ascii=False)

        existing = db.session.get(UserGroup, group_id)
        if existing:
            existing.name = row.get('name', '')
            existing.description = row.get('description', '')
            existing.member_ids = member_ids
            existing.updated_at = safe_datetime(row.get('updated_at')) or datetime.utcnow()
        else:
            db.session.add(UserGroup(
                group_id=group_id,
                name=row.get('name', ''),
                description=row.get('description', ''),
                member_ids=member_ids,
                created_at=safe_datetime(row.get('created_at')) or datetime.utcnow(),
                updated_at=safe_datetime(row.get('updated_at')) or datetime.utcnow(),
            ))
        count += 1
    db.session.commit()
    print(f"  ✅ UserGroups: {count} 条记录")
    return count


def migrate_courses(db, Course):
    """从 courses.json 迁移课程数据"""
    print("\n📋 迁移 Courses (from courses.json)...")
    courses_dir = os.getenv('COURSES_DIR', os.path.join(os.path.dirname(backend_dir), 'courses'))
    courses_json_path = os.path.join(courses_dir, 'courses.json')

    if not os.path.exists(courses_json_path):
        print(f"  ⚠️ courses.json 不存在: {courses_json_path}")
        return 0

    with open(courses_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    count = 0
    for c in data.get('courses', []):
        course_id = c.get('id', '')
        if not course_id:
            continue

        quiz = c.get('quiz', {})

        existing = db.session.get(Course, course_id)
        if existing:
            existing.title = c.get('title', '')
            existing.description = c.get('description', '')
            existing.type = c.get('type', 'pdf')
            existing.media_url = c.get('mediaUrl', '')
            existing.thumbnail_url = c.get('thumbnailUrl', '')
            existing.total_pages = safe_int(c.get('totalPages'))
            existing.duration_minutes = safe_int(c.get('duration_minutes'))
            existing.order = safe_int(c.get('order'))
            existing.tags = json.dumps(c.get('tags', []), ensure_ascii=False)
            existing.prerequisites = json.dumps(c.get('prerequisites', []), ensure_ascii=False)
            existing.is_published = c.get('is_published', True)
            existing.icon = c.get('icon')
            existing.quiz_survey_id = quiz.get('survey_id') if quiz else None
            existing.quiz_pass_score = safe_int(quiz.get('pass_score'), 60) if quiz else 60
            existing.updated_at = safe_datetime(c.get('updated_at')) or datetime.utcnow()
        else:
            db.session.add(Course(
                id=course_id,
                title=c.get('title', ''),
                description=c.get('description', ''),
                type=c.get('type', 'pdf'),
                media_url=c.get('mediaUrl', ''),
                thumbnail_url=c.get('thumbnailUrl', ''),
                total_pages=safe_int(c.get('totalPages')),
                duration_minutes=safe_int(c.get('duration_minutes')),
                order=safe_int(c.get('order')),
                tags=json.dumps(c.get('tags', []), ensure_ascii=False),
                prerequisites=json.dumps(c.get('prerequisites', []), ensure_ascii=False),
                is_published=c.get('is_published', True),
                icon=c.get('icon'),
                quiz_survey_id=quiz.get('survey_id') if quiz else None,
                quiz_pass_score=safe_int(quiz.get('pass_score'), 60) if quiz else 60,
                created_at=safe_datetime(c.get('created_at')) or datetime.utcnow(),
                updated_at=safe_datetime(c.get('updated_at')) or datetime.utcnow(),
            ))
        count += 1
    db.session.commit()
    print(f"  ✅ Courses: {count} 条记录")
    return count


def migrate_syllabi(db, Syllabus):
    """从 syllabi.json 迁移课程表数据"""
    print("\n📋 迁移 Syllabi (from syllabi.json)...")
    data_dir = os.getenv('DATA_DIR', os.path.join(backend_dir, 'data'))
    syllabi_json_path = os.path.join(data_dir, 'syllabi.json')

    if not os.path.exists(syllabi_json_path):
        print(f"  ⚠️ syllabi.json 不存在: {syllabi_json_path}")
        return 0

    with open(syllabi_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    count = 0
    for s in data.get('syllabi', []):
        syl_id = s.get('id', '')
        if not syl_id:
            continue

        existing = db.session.get(Syllabus, syl_id)
        if existing:
            existing.name = s.get('name', '')
            existing.description = s.get('description', '')
            existing.cover_image_url = s.get('cover_image_url', '')
            existing.course_sequence = json.dumps(s.get('course_sequence', []), ensure_ascii=False)
            existing.access_type = s.get('access_type', 'public')
            existing.access_rules = json.dumps(s.get('access_rules', {}), ensure_ascii=False)
            existing.time_config = json.dumps(s.get('time_config', {}), ensure_ascii=False)
            existing.theme = s.get('theme', 'default')
            existing.is_published = s.get('is_published', False)
            existing.updated_at = safe_datetime(s.get('updated_at')) or datetime.utcnow()
        else:
            db.session.add(Syllabus(
                id=syl_id,
                name=s.get('name', ''),
                description=s.get('description', ''),
                cover_image_url=s.get('cover_image_url', ''),
                course_sequence=json.dumps(s.get('course_sequence', []), ensure_ascii=False),
                access_type=s.get('access_type', 'public'),
                access_rules=json.dumps(s.get('access_rules', {}), ensure_ascii=False),
                time_config=json.dumps(s.get('time_config', {}), ensure_ascii=False),
                theme=s.get('theme', 'default'),
                is_published=s.get('is_published', False),
                created_at=safe_datetime(s.get('created_at')) or datetime.utcnow(),
                updated_at=safe_datetime(s.get('updated_at')) or datetime.utcnow(),
            ))
        count += 1
    db.session.commit()
    print(f"  ✅ Syllabi: {count} 条记录")
    return count


def main():
    print("=" * 60)
    print("TrainPMA: Google Sheets + JSON → PostgreSQL 数据迁移")
    print("=" * 60)

    # 连接 Google Sheets
    print("\n🔗 连接 Google Sheets...")
    spreadsheet = connect_sheets()
    print("  ✅ 连接成功")

    # 创建 Flask app 并初始化数据库
    print("\n🔗 连接 PostgreSQL...")
    from app import create_app
    app = create_app()

    with app.app_context():
        from app.models import (
            db, User, Survey, Question, Response, Score,
            UserProgress, Certificate, CourseBadge, UserGroup,
            Course, Syllabus
        )

        # 创建所有表
        db.create_all()
        print("  ✅ 数据库表已创建/更新")

        # 迁移统计
        stats = {}

        # 按依赖顺序迁移
        stats['Users'] = migrate_users(spreadsheet, db, User)
        stats['Surveys'] = migrate_surveys(spreadsheet, db, Survey)
        stats['Questions'] = migrate_questions(spreadsheet, db, Question)
        stats['Responses'] = migrate_responses(spreadsheet, db, Response)
        stats['Scores'] = migrate_scores(spreadsheet, db, Score)
        stats['UserProgress'] = migrate_user_progress(spreadsheet, db, UserProgress)
        stats['Certificates'] = migrate_certificates(spreadsheet, db, Certificate)
        stats['CourseBadges'] = migrate_course_badges(spreadsheet, db, CourseBadge)
        stats['UserGroups'] = migrate_user_groups(spreadsheet, db, UserGroup)
        stats['Courses'] = migrate_courses(db, Course)
        stats['Syllabi'] = migrate_syllabi(db, Syllabus)

        # 打印统计
        print("\n" + "=" * 60)
        print("📊 迁移统计:")
        print("=" * 60)
        total = 0
        for table, count in stats.items():
            print(f"  {table:20s}: {count:6d} 条")
            total += count
        print(f"  {'总计':20s}: {total:6d} 条")
        print("=" * 60)
        print("✅ 迁移完成!")


if __name__ == '__main__':
    main()
