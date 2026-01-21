"""
进度同步路由
提供用户进度的获取、保存和同步功能
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.progress_service import progress_service

progress_bp = Blueprint('progress', __name__, url_prefix='/api/progress')


@progress_bp.route('', methods=['GET'])
@jwt_required()
def get_progress():
    """
    获取当前用户进度

    Headers:
        Authorization: Bearer <token>

    Response:
        成功: {
            "success": true,
            "data": {
                "streak": 0,
                "lastReadDate": null,
                "totalXP": 0,
                "hearts": 5,
                "maxHearts": 5,
                "dailyGoalMinutes": 10,
                "currentChapter": 1,
                "currentSection": 0,
                "chaptersCompleted": [],
                "achievements": [],
                "wordsLearned": [],
                "totalReadingTime": 0,
                "onboardingCompleted": false
            }
        }
    """
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '用户未登录'}), 401

        progress = progress_service.get_user_progress(user_id)

        if progress is None:
            # 用户没有进度记录，返回默认进度
            progress = progress_service.get_default_progress()

        return jsonify({
            'success': True,
            'data': progress
        }), 200

    except Exception as e:
        print(f"❌ 获取进度失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取进度失败: {str(e)}'
        }), 500


@progress_bp.route('', methods=['POST'])
@jwt_required()
def save_progress():
    """
    保存用户进度

    Headers:
        Authorization: Bearer <token>

    Request Body:
        {
            "streak": 0,
            "lastReadDate": null,
            "totalXP": 0,
            "hearts": 5,
            "maxHearts": 5,
            "dailyGoalMinutes": 10,
            "currentChapter": 1,
            "currentSection": 0,
            "chaptersCompleted": [],
            "achievements": [],
            "wordsLearned": [],
            "totalReadingTime": 0,
            "onboardingCompleted": false
        }

    Response:
        成功: { "success": true, "message": "进度保存成功" }
        失败: { "success": false, "message": "错误信息" }
    """
    try:
        user_id = get_jwt_identity()
        print(f"========== SAVE PROGRESS DEBUG ==========")
        print(f"[SaveProgress] user_id from JWT: {user_id}")

        if not user_id:
            print(f"[SaveProgress] ❌ No user_id - returning 401")
            return jsonify({'success': False, 'message': '用户未登录'}), 401

        data = request.get_json()
        print(f"[SaveProgress] Received data: hearts={data.get('hearts')}, totalXP={data.get('totalXP')}, streak={data.get('streak')}")

        if not data:
            print(f"[SaveProgress] ❌ No data in request")
            return jsonify({'success': False, 'message': '请求数据为空'}), 400

        # 验证必需字段
        required_fields = [
            'streak', 'totalXP', 'hearts', 'maxHearts', 'dailyGoalMinutes',
            'currentChapter', 'currentSection', 'chaptersCompleted',
            'achievements', 'wordsLearned', 'totalReadingTime', 'onboardingCompleted',
            # 培训系统新增字段
            'coursesCompleted', 'quizzesPassed', 'quizStreak',
            # XP 奖励系统字段
            'lastLoginRewardDate', 'firstPassedQuizzes',
            # 错题记录
            'wrongQuestions',
            # 课程表 XP 统计
            'xpBySyllabus',
            # 首次登录奖励
            'firstLoginRewardClaimed'
        ]

        progress = {}
        for field in required_fields:
            if field in data:
                progress[field] = data[field]

        # lastReadDate 可选
        if 'lastReadDate' in data:
            progress['lastReadDate'] = data['lastReadDate']

        print(f"[SaveProgress] Final progress object: {progress}")

        print(f"[SaveProgress] Saving progress for user {user_id}: hearts={progress.get('hearts')}, totalXP={progress.get('totalXP')}")
        success = progress_service.save_user_progress(user_id, progress)

        if success:
            print(f"[SaveProgress] ✅ Progress saved successfully for {user_id}")
            print(f"========== SAVE PROGRESS DEBUG END ==========")
            return jsonify({
                'success': True,
                'message': '进度保存成功'
            }), 200
        else:
            print(f"[SaveProgress] ❌ Progress save failed for {user_id}")
            print(f"========== SAVE PROGRESS DEBUG END ==========")
            return jsonify({
                'success': False,
                'message': '进度保存失败'
            }), 500

    except Exception as e:
        print(f"❌ 保存进度失败: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"========== SAVE PROGRESS DEBUG END ==========")
        return jsonify({
            'success': False,
            'message': f'保存进度失败: {str(e)}'
        }), 500


@progress_bp.route('/sync', methods=['POST'])
@jwt_required()
def sync_progress():
    """
    双向同步进度 (处理冲突)
    服务器是唯一数据源，客户端数据会覆盖服务器

    Headers:
        Authorization: Bearer <token>

    Request Body:
        {
            "clientProgress": { ... },  // 客户端当前进度
            "lastSyncTime": "..."       // 上次同步时间 (可选)
        }

    Response:
        成功: {
            "success": true,
            "data": { ... },  // 合并后的进度
            "syncTime": "..." // 当前同步时间
        }
    """
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '用户未登录'}), 401

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': '请求数据为空'}), 400

        client_progress = data.get('clientProgress')
        if not client_progress:
            return jsonify({'success': False, 'message': '客户端进度数据为空'}), 400

        # 获取服务器端进度
        server_progress = progress_service.get_user_progress(user_id)

        # 如果服务器没有进度，直接保存客户端进度
        if server_progress is None:
            progress_service.save_user_progress(user_id, client_progress)
            return jsonify({
                'success': True,
                'data': client_progress,
                'syncTime': __import__('datetime').datetime.now().isoformat()
            }), 200

        # 合并策略：客户端数据优先（因为用户正在使用）
        # 但保留服务器端更高的数值（防止数据丢失）
        merged = _merge_progress(server_progress, client_progress)

        # 保存合并后的进度
        progress_service.save_user_progress(user_id, merged)

        return jsonify({
            'success': True,
            'data': merged,
            'syncTime': __import__('datetime').datetime.now().isoformat()
        }), 200

    except Exception as e:
        print(f"❌ 同步进度失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'同步进度失败: {str(e)}'
        }), 500


@progress_bp.route('/leaderboard', methods=['GET'])
@jwt_required()
def get_xp_leaderboard():
    """
    获取排行榜 - 根据用户类型自动返回不同数据

    Query Params:
        type: string - 可选: 'auto' | 'syllabus' (默认 'auto')
        syllabus_id: string - 当 type='syllabus' 时必填

    Response:
        - 客人 (无 type 参数): 返回 groups 类型或 self_only 类型
        - 员工 (无 type 参数): 返回 employees 类型
        - type='syllabus': 返回 syllabus 类型
    """
    try:
        leaderboard_type = request.args.get('type', 'auto')
        syllabus_id = request.args.get('syllabus_id')

        # 获取当前用户信息
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '请先登录'}), 401

        # 判断用户类型
        user_type = 'employee' if user_id.startswith('emp_') else 'guest'

        result = progress_service.get_leaderboard(
            user_id=user_id,
            user_type=user_type,
            leaderboard_type=leaderboard_type,
            syllabus_id=syllabus_id
        )

        return jsonify({'success': True, 'data': result}), 200
    except Exception as e:
        print(f"❌ 获取排行榜失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'获取排行榜失败: {str(e)}'
        }), 500


def _merge_progress(server: dict, client: dict) -> dict:
    """
    合并服务器和客户端进度

    策略：
    - 累积值 (XP, 阅读时间): 取较大值
    - 当前位置 (章节、小节): 取客户端值 (用户当前操作)
    - 数组 (成就、单词): 合并去重
    - 布尔值: 有 True 则为 True
    - 连续签到: 根据日期判断
    """
    merged = {}

    # 累积值 - 取较大值
    merged['totalXP'] = max(
        int(server.get('totalXP', 0) or 0),
        int(client.get('totalXP', 0) or 0)
    )
    merged['totalReadingTime'] = max(
        int(server.get('totalReadingTime', 0) or 0),
        int(client.get('totalReadingTime', 0) or 0)
    )

    # 生命值 - 取客户端值 (实时状态)
    merged['hearts'] = int(client.get('hearts', 5) or 5)
    merged['maxHearts'] = int(client.get('maxHearts', 5) or 5)

    # 当前位置 - 取客户端值
    merged['currentChapter'] = int(client.get('currentChapter', 1) or 1)
    merged['currentSection'] = int(client.get('currentSection', 0) or 0)

    # 目标设置 - 取客户端值
    merged['dailyGoalMinutes'] = int(client.get('dailyGoalMinutes', 10) or 10)

    # 数组 - 合并去重
    server_chapters = set(server.get('chaptersCompleted', []) or [])
    client_chapters = set(client.get('chaptersCompleted', []) or [])
    merged['chaptersCompleted'] = list(server_chapters | client_chapters)

    server_achievements = set(server.get('achievements', []) or [])
    client_achievements = set(client.get('achievements', []) or [])
    merged['achievements'] = list(server_achievements | client_achievements)

    server_words = set(server.get('wordsLearned', []) or [])
    client_words = set(client.get('wordsLearned', []) or [])
    merged['wordsLearned'] = list(server_words | client_words)

    # 布尔值 - 有 True 则为 True
    merged['onboardingCompleted'] = (
        server.get('onboardingCompleted', False) or
        client.get('onboardingCompleted', False)
    )

    # 连续签到 - 使用客户端值 (用户当前状态)
    merged['streak'] = int(client.get('streak', 0) or 0)
    merged['lastReadDate'] = client.get('lastReadDate')

    # 错题记录 - 合并去重（基于 id）
    server_wrong = {q.get('id'): q for q in (server.get('wrongQuestions') or [])}
    client_wrong = {q.get('id'): q for q in (client.get('wrongQuestions') or [])}
    # 客户端数据优先（更新后的状态）
    merged_wrong = {**server_wrong, **client_wrong}
    merged['wrongQuestions'] = list(merged_wrong.values())

    # 课程表 XP - 取较大值（每个课程表独立）
    server_xp_by_syllabus = server.get('xpBySyllabus', {}) or {}
    client_xp_by_syllabus = client.get('xpBySyllabus', {}) or {}
    merged_xp_by_syllabus = {}
    all_syllabus_ids = set(server_xp_by_syllabus.keys()) | set(client_xp_by_syllabus.keys())
    for syllabus_id in all_syllabus_ids:
        merged_xp_by_syllabus[syllabus_id] = max(
            server_xp_by_syllabus.get(syllabus_id, 0),
            client_xp_by_syllabus.get(syllabus_id, 0)
        )
    merged['xpBySyllabus'] = merged_xp_by_syllabus

    return merged
