"""用户组路由"""
import os
import json
from flask import Blueprint, request, jsonify
from app.services.user_group_service import user_group_service
from app.services.sheets_service import sheets_service
from app.services.pma_api_service import get_all_employees, get_raw_employees
from app.utils import api_key_required

user_group_bp = Blueprint('user_group', __name__, url_prefix='/api/admin')


# ==================== 数据迁移 API（放在 <group_id> 路由之前避免冲突） ====================

@user_group_bp.route('/user-groups/migrate-to-sheets', methods=['POST'])
@api_key_required
def migrate_user_groups_to_sheets():
    """将 user_groups.json 迁移到 Google Sheets，并修正旧的 member_ids

    逻辑：
    1. 读取 user_groups.json
    2. 从外部 API 获取原始员工数据，构建 emp_{user_id} → emp_{id} 映射
    3. 修正每个组的 member_ids
    4. 写入 Google Sheets UserGroups worksheet
    """
    try:
        # 1. 读取 JSON 文件
        data_dir = os.getenv('DATA_DIR', os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data'))
        json_path = os.path.join(data_dir, 'user_groups.json')

        if not os.path.exists(json_path):
            return jsonify({'success': False, 'message': 'user_groups.json 不存在'}), 404

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        groups = data.get('user_groups', [])
        if not groups:
            return jsonify({'success': False, 'message': 'user_groups.json 中没有用户组数据'}), 400

        # 2. 获取原始员工数据，构建 old_id → new_id 映射
        raw_employees = get_raw_employees()
        id_mapping = {}  # emp_{user_id} → emp_{id}
        for emp in raw_employees:
            raw_user_id = emp.get('user_id')  # 外部 API 的 user_id 字段
            raw_id = emp.get('id')            # 外部 API 的 id 字段
            source = emp.get('source', 'sp8d')

            if raw_user_id is not None and raw_id is not None and str(raw_user_id) != str(raw_id):
                if source == 'ovs':
                    old_key = f"emp_ovs_{raw_user_id}"
                    new_key = f"emp_ovs_{raw_id}"
                else:
                    old_key = f"emp_{raw_user_id}"
                    new_key = f"emp_{raw_id}"
                id_mapping[old_key] = new_key

        # 3. 迁移每个组到 Sheets
        sheet = sheets_service.user_groups_sheet
        migrated = []
        id_fixes = []

        for group in groups:
            group_id = group.get('id', '')
            name = group.get('name', '')
            description = group.get('description', '')
            old_member_ids = group.get('member_ids', [])
            created_at = group.get('created_at', '')
            updated_at = group.get('updated_at', '')

            # 修正 member_ids
            new_member_ids = []
            for mid in old_member_ids:
                if mid in id_mapping:
                    id_fixes.append({'old': mid, 'new': id_mapping[mid], 'group': name})
                    new_member_ids.append(id_mapping[mid])
                else:
                    new_member_ids.append(mid)

            member_ids_json = json.dumps(new_member_ids, ensure_ascii=False)
            sheet.append_row([group_id, name, description, member_ids_json, created_at, updated_at])

            migrated.append({
                'group_id': group_id,
                'name': name,
                'member_count': len(new_member_ids),
                'member_ids': new_member_ids,
            })

        # 清除缓存
        sheets_service.clear_cache('user_groups')

        return jsonify({
            'success': True,
            'message': f'成功迁移 {len(migrated)} 个用户组到 Google Sheets',
            'data': {
                'migrated_groups': migrated,
                'id_fixes': id_fixes,
                'id_mapping_count': len(id_mapping),
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'迁移失败: {str(e)}'}), 500


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
