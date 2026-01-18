"""课程表路由"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.services.syllabus_service import syllabus_service
from app.services.course_service import course_service
from app.utils import api_key_required

syllabus_bp = Blueprint('syllabus', __name__, url_prefix='/api')


# ==================== 用户 API ====================

def _parse_jwt_identity(identity) -> dict:
    """解析 JWT identity 为标准 user_info 格式

    新格式: identity 是字符串 (user_id)，额外信息在 JWT claims 中
    旧格式: identity 是字典（已废弃，但保持兼容）
    """
    # 获取 JWT claims (包含 user_type, accessible_syllabi)
    claims = get_jwt()

    if isinstance(identity, str):
        # 新格式: identity 是字符串，额外信息从 claims 读取
        return {
            'user_id': identity,
            'user_type': claims.get('user_type', 'guest'),
            'accessible_syllabi': claims.get('accessible_syllabi', [])
        }
    elif isinstance(identity, dict):
        # 兼容旧格式 (identity 是字典 - 已废弃)
        return {
            'user_id': identity.get('user_id', ''),
            'user_type': identity.get('user_type', 'guest'),
            'accessible_syllabi': identity.get('accessible_syllabi', [])
        }
    return {'user_id': '', 'user_type': 'guest', 'accessible_syllabi': []}


@syllabus_bp.route('/syllabi', methods=['GET'])
@jwt_required()
def get_accessible_syllabi():
    """获取用户可访问的课程表列表"""
    try:
        user_info = _parse_jwt_identity(get_jwt_identity())
        syllabi = syllabus_service.get_accessible_syllabi(user_info)
        return jsonify({'success': True, 'data': syllabi})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/syllabi/<syllabus_id>', methods=['GET'])
@jwt_required()
def get_syllabus_detail(syllabus_id):
    """获取课程表详情"""
    try:
        user_info = _parse_jwt_identity(get_jwt_identity())

        syllabus = syllabus_service.get_syllabus(syllabus_id)
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404

        # 检查访问权限
        if not syllabus_service.can_access_syllabus(user_info, syllabus):
            return jsonify({'success': False, 'message': '无权访问此课程表'}), 403

        return jsonify({'success': True, 'data': syllabus})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/syllabi/<syllabus_id>/courses', methods=['GET'])
@jwt_required()
def get_syllabus_courses(syllabus_id):
    """获取课程表中的课程列表（含进度）"""
    try:
        user_info = _parse_jwt_identity(get_jwt_identity())

        syllabus = syllabus_service.get_syllabus(syllabus_id)
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404

        # 检查访问权限
        if not syllabus_service.can_access_syllabus(user_info, syllabus):
            return jsonify({'success': False, 'message': '无权访问此课程表'}), 403

        # 获取课程详情
        course_sequence = syllabus.get('course_sequence', [])
        courses_with_details = []

        for item in sorted(course_sequence, key=lambda x: x.get('order', 999)):
            course = course_service.get_course(item.get('course_id'))
            if course:
                courses_with_details.append({
                    **course,
                    'order_in_syllabus': item.get('order'),
                    'is_optional': item.get('is_optional', False)
                })

        return jsonify({'success': True, 'data': courses_with_details})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== 管理员 API ====================

@syllabus_bp.route('/admin/syllabi', methods=['GET'])
@api_key_required
def admin_get_syllabi():
    """获取所有课程表（管理员）"""
    try:
        syllabi = syllabus_service.get_all_syllabi(include_unpublished=True)
        return jsonify({'success': True, 'data': syllabi})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi', methods=['POST'])
@api_key_required
def create_syllabus():
    """创建新课程表"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        cover_image_url = data.get('cover_image_url', '').strip()

        if not name:
            return jsonify({'success': False, 'message': '课程表名称不能为空'}), 400

        syllabus = syllabus_service.create_syllabus(
            name=name,
            description=description,
            cover_image_url=cover_image_url
        )

        return jsonify({'success': True, 'data': syllabus}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>', methods=['GET'])
@api_key_required
def admin_get_syllabus(syllabus_id):
    """获取单个课程表详情（管理员）"""
    try:
        syllabus = syllabus_service.get_syllabus(syllabus_id)
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404
        return jsonify({'success': True, 'data': syllabus})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>', methods=['PUT'])
@api_key_required
def update_syllabus(syllabus_id):
    """更新课程表信息"""
    try:
        data = request.get_json()
        syllabus = syllabus_service.update_syllabus(syllabus_id, data)
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404
        return jsonify({'success': True, 'data': syllabus})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>', methods=['DELETE'])
@api_key_required
def delete_syllabus(syllabus_id):
    """删除课程表"""
    try:
        success = syllabus_service.delete_syllabus(syllabus_id)
        if not success:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404
        return jsonify({'success': True, 'message': '课程表已删除'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>/publish', methods=['POST'])
@api_key_required
def publish_syllabus(syllabus_id):
    """发布课程表"""
    try:
        syllabus = syllabus_service.publish_syllabus(syllabus_id)
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404
        return jsonify({'success': True, 'data': syllabus})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>/unpublish', methods=['POST'])
@api_key_required
def unpublish_syllabus(syllabus_id):
    """取消发布课程表"""
    try:
        syllabus = syllabus_service.unpublish_syllabus(syllabus_id)
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404
        return jsonify({'success': True, 'data': syllabus})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>/courses', methods=['POST'])
@api_key_required
def add_course_to_syllabus(syllabus_id):
    """添加课程到课程表"""
    try:
        data = request.get_json()
        course_id = data.get('course_id')
        is_optional = data.get('is_optional', False)

        if not course_id:
            return jsonify({'success': False, 'message': '课程ID不能为空'}), 400

        syllabus = syllabus_service.add_course_to_syllabus(
            syllabus_id=syllabus_id,
            course_id=course_id,
            is_optional=is_optional
        )
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404

        return jsonify({'success': True, 'data': syllabus})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>/courses/<course_id>', methods=['DELETE'])
@api_key_required
def remove_course_from_syllabus(syllabus_id, course_id):
    """从课程表移除课程"""
    try:
        syllabus = syllabus_service.remove_course_from_syllabus(syllabus_id, course_id)
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404
        return jsonify({'success': True, 'data': syllabus})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>/courses/reorder', methods=['POST'])
@api_key_required
def reorder_courses_in_syllabus(syllabus_id):
    """重新排序课程表中的课程"""
    try:
        data = request.get_json()
        course_ids = data.get('course_ids', [])
        syllabus = syllabus_service.reorder_courses_in_syllabus(syllabus_id, course_ids)
        if not syllabus:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404
        return jsonify({'success': True, 'data': syllabus})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== 邀请码管理 API ====================

@syllabus_bp.route('/admin/syllabi/<syllabus_id>/invitation-code', methods=['POST'])
@api_key_required
def generate_invitation_code(syllabus_id):
    """
    生成邀请码

    Request Body:
        {
            "expires_at": "2026-03-01T23:59:59+08:00",  // 可选，过期时间
            "max_uses": 100,                            // 可选，最大使用次数
            "custom_code": "CONNECT2026"                // 可选，自定义邀请码
        }
    """
    try:
        data = request.get_json() or {}
        expires_at = data.get('expires_at')
        max_uses = data.get('max_uses')
        custom_code = data.get('custom_code')

        invitation = syllabus_service.generate_invitation_code(
            syllabus_id=syllabus_id,
            expires_at=expires_at,
            max_uses=max_uses,
            custom_code=custom_code
        )

        if not invitation:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404

        return jsonify({'success': True, 'data': invitation}), 201
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>/invitation-code', methods=['GET'])
@api_key_required
def get_invitation_code(syllabus_id):
    """获取邀请码信息"""
    try:
        invitation = syllabus_service.get_invitation_code_info(syllabus_id)

        if invitation is None:
            # 检查课程表是否存在
            syllabus = syllabus_service.get_syllabus(syllabus_id)
            if not syllabus:
                return jsonify({'success': False, 'message': '课程表不存在'}), 404
            # 课程表存在但没有邀请码
            return jsonify({'success': True, 'data': None})

        return jsonify({'success': True, 'data': invitation})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@syllabus_bp.route('/admin/syllabi/<syllabus_id>/invitation-code', methods=['DELETE'])
@api_key_required
def delete_invitation_code(syllabus_id):
    """删除邀请码"""
    try:
        success = syllabus_service.delete_invitation_code(syllabus_id)
        if not success:
            return jsonify({'success': False, 'message': '课程表不存在'}), 404
        return jsonify({'success': True, 'message': '邀请码已删除'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
