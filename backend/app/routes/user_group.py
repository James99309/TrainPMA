"""用户组路由"""
from flask import Blueprint, request, jsonify
from app.services.user_group_service import user_group_service
from app.services.sheets_service import sheets_service
from app.services.pma_api_service import get_all_employees
from app.utils import api_key_required

user_group_bp = Blueprint('user_group', __name__, url_prefix='/api/admin')


# ==================== 用户组管理 API ====================

@user_group_bp.route('/user-groups', methods=['GET'])
@api_key_required
def get_user_groups():
    """获取所有用户组"""
    try:
        groups = user_group_service.get_all_user_groups()
        return jsonify({'success': True, 'data': groups})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@user_group_bp.route('/user-groups', methods=['POST'])
@api_key_required
def create_user_group():
    """创建新用户组"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()

        if not name:
            return jsonify({'success': False, 'message': '用户组名称不能为空'}), 400

        group = user_group_service.create_user_group(
            name=name,
            description=description
        )

        return jsonify({'success': True, 'data': group}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@user_group_bp.route('/user-groups/<group_id>', methods=['GET'])
@api_key_required
def get_user_group(group_id):
    """获取单个用户组详情"""
    try:
        group = user_group_service.get_user_group(group_id)
        if not group:
            return jsonify({'success': False, 'message': '用户组不存在'}), 404
        return jsonify({'success': True, 'data': group})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@user_group_bp.route('/user-groups/<group_id>', methods=['PUT'])
@api_key_required
def update_user_group(group_id):
    """更新用户组信息"""
    try:
        data = request.get_json()
        group = user_group_service.update_user_group(group_id, data)
        if not group:
            return jsonify({'success': False, 'message': '用户组不存在'}), 404
        return jsonify({'success': True, 'data': group})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@user_group_bp.route('/user-groups/<group_id>', methods=['DELETE'])
@api_key_required
def delete_user_group(group_id):
    """删除用户组"""
    try:
        success = user_group_service.delete_user_group(group_id)
        if not success:
            return jsonify({'success': False, 'message': '用户组不存在'}), 404
        return jsonify({'success': True, 'message': '用户组已删除'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== 成员管理 API ====================

@user_group_bp.route('/user-groups/<group_id>/members', methods=['POST'])
@api_key_required
def add_member_to_group(group_id):
    """添加成员到用户组"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        user_ids = data.get('user_ids', [])

        if user_id:
            user_ids = [user_id]

        if not user_ids:
            return jsonify({'success': False, 'message': '用户ID不能为空'}), 400

        if len(user_ids) == 1:
            group = user_group_service.add_member(group_id, user_ids[0])
        else:
            group = user_group_service.add_members_batch(group_id, user_ids)

        if not group:
            return jsonify({'success': False, 'message': '用户组不存在'}), 404

        return jsonify({'success': True, 'data': group})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@user_group_bp.route('/user-groups/<group_id>/members/<user_id>', methods=['DELETE'])
@api_key_required
def remove_member_from_group(group_id, user_id):
    """从用户组移除成员"""
    try:
        group = user_group_service.remove_member(group_id, user_id)
        if not group:
            return jsonify({'success': False, 'message': '用户组不存在'}), 404
        return jsonify({'success': True, 'data': group})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== 用户搜索 API ====================

@user_group_bp.route('/users/search', methods=['GET'])
@api_key_required
def search_users():
    """搜索用户

    优先从 PMA 系统搜索员工，若 PMA 未配置则回退到 Google Sheets
    """
    try:
        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 20))

        if not query:
            return jsonify({'success': True, 'data': []})

        # 优先从 PMA 系统搜索
        users = get_all_employees(limit=limit, search=query)
        if users:
            return jsonify({'success': True, 'data': users, 'source': 'pma'})

        # 回退到 Google Sheets 搜索
        users = sheets_service.search_users(query, limit)
        return jsonify({'success': True, 'data': users, 'source': 'sheets'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@user_group_bp.route('/users/all', methods=['GET'])
@api_key_required
def get_all_users():
    """获取所有用户列表

    优先从 PMA 系统获取员工数据，若 PMA 未配置则回退到 Google Sheets
    """
    try:
        limit = int(request.args.get('limit', 500))
        offset = int(request.args.get('offset', 0))
        search = request.args.get('search', '').strip()

        # 优先从 PMA 系统获取员工
        users = get_all_employees(limit, offset, search)
        if users:
            return jsonify({'success': True, 'data': users, 'source': 'pma'})

        # 回退到 Google Sheets
        users = sheets_service.get_all_users(limit, offset)
        return jsonify({'success': True, 'data': users, 'source': 'sheets'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
