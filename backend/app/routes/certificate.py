"""
证书路由
提供证书的颁发、查询功能
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.certificate_service import certificate_service
from app.utils import api_key_required

certificate_bp = Blueprint('certificate', __name__, url_prefix='/api')


# ==================== 用户端 API ====================

@certificate_bp.route('/certificates', methods=['GET'])
@jwt_required()
def get_user_certificates():
    """
    获取当前用户的所有证书

    Headers:
        Authorization: Bearer <token>

    Response:
        成功: {
            "success": true,
            "data": [
                {
                    "certificate_id": "cert-xxx",
                    "user_id": "emp_123",
                    "user_name": "张三",
                    "user_company": "SP8D",
                    "syllabus_id": "syl-xxx",
                    "syllabus_name": "2026 Connect Day",
                    "score": 900,
                    "max_score": 900,
                    "rank": 1,
                    "total_participants": 50,
                    "course_scores": {...},
                    "issued_at": "2026-01-22T12:00:00",
                    "issued_by": "admin"
                }
            ]
        }
    """
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '用户未登录'}), 401

        certificates = certificate_service.get_user_certificates(user_id)

        return jsonify({
            'success': True,
            'data': certificates
        }), 200

    except Exception as e:
        print(f"❌ 获取用户证书失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取证书失败: {str(e)}'
        }), 500


@certificate_bp.route('/certificates/<certificate_id>', methods=['GET'])
def get_certificate_detail(certificate_id):
    """
    获取证书详情 (公开访问，用于分享)

    Args:
        certificate_id: 证书ID

    Response:
        成功: {
            "success": true,
            "data": {
                "certificate_id": "cert-xxx",
                ...
            }
        }
    """
    try:
        certificate = certificate_service.get_certificate_by_id(certificate_id)

        if not certificate:
            return jsonify({
                'success': False,
                'message': '证书不存在'
            }), 404

        return jsonify({
            'success': True,
            'data': certificate
        }), 200

    except Exception as e:
        print(f"❌ 获取证书详情失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取证书详情失败: {str(e)}'
        }), 500


# ==================== 管理端 API ====================

@certificate_bp.route('/admin/certificates/issue/<syllabus_id>', methods=['POST'])
@api_key_required
def issue_certificates(syllabus_id):
    """
    为课程表所有参与者颁发证书 (管理员)

    Args:
        syllabus_id: 课程表ID

    Headers:
        X-API-Key: <admin_api_key>

    Request Body (可选):
        {
            "issued_by": "admin"  // 颁发者名称
        }

    Response:
        成功: {
            "success": true,
            "certificates_issued": 36,
            "total_participants": 36,
            "skipped": 0,
            "certificates": [...]
        }
    """
    try:
        data = request.get_json() or {}
        issued_by = data.get('issued_by', 'admin')

        result = certificate_service.issue_certificates_for_syllabus(
            syllabus_id=syllabus_id,
            issued_by=issued_by
        )

        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        print(f"❌ 颁发证书失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'颁发证书失败: {str(e)}'
        }), 500


@certificate_bp.route('/admin/certificates/syllabus/<syllabus_id>', methods=['GET'])
@api_key_required
def get_syllabus_certificates(syllabus_id):
    """
    获取课程表的证书统计信息 (管理员)

    Args:
        syllabus_id: 课程表ID

    Headers:
        X-API-Key: <admin_api_key>

    Response:
        成功: {
            "success": true,
            "data": {
                "total_certificates": 36,
                "certificates": [...]
            }
        }
    """
    try:
        stats = certificate_service.get_syllabus_certificate_stats(syllabus_id)

        return jsonify({
            'success': True,
            'data': stats
        }), 200

    except Exception as e:
        print(f"❌ 获取证书统计失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取证书统计失败: {str(e)}'
        }), 500
