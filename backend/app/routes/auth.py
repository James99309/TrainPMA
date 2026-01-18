"""
认证路由
支持客人登录和员工登录两种模式
"""
from flask import Blueprint, request, jsonify
from app.services import auth_service
from app.services.syllabus_service import syllabus_service

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    统一登录接口 - 支持客人和员工两种登录模式

    Request Body:
        客人登录:
        {
            "login_type": "guest",  // 可选，默认为 guest
            "name": "姓名",
            "company": "公司名称",
            "phone": "手机号码",
            "remember_me": false    // 可选
        }

        员工登录:
        {
            "login_type": "employee",
            "username": "员工账户",
            "password": "密码",
            "remember_me": false    // 可选
        }

    Response:
        成功: {
            "success": true,
            "data": {
                "user_id": "...",
                "name": "...",
                "company": "...",
                "user_type": "guest" | "employee",
                "token": "...",
                ...
            }
        }
        失败: {
            "success": false,
            "message": "错误信息"
        }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': '请求数据为空'}), 400

        login_type = data.get('login_type', 'guest')
        remember_me = data.get('remember_me', False)

        if login_type == 'employee':
            # 员工登录 - 调用 PMA 系统验证
            username = data.get('username')
            password = data.get('password')

            if not username:
                return jsonify({'success': False, 'message': '账户不能为空'}), 400
            if not password:
                return jsonify({'success': False, 'message': '密码不能为空'}), 400

            result = auth_service.employee_login(username, password, remember_me)

            if result['success']:
                return jsonify(result), 200
            else:
                return jsonify(result), 401

        else:
            # 客人登录 (默认)
            name = data.get('name')
            company = data.get('company')
            phone = data.get('phone')
            invitation_code = data.get('invitation_code', '').strip()

            # 验证必填字段
            missing_fields = []
            if not name:
                missing_fields.append('姓名')
            if not company:
                missing_fields.append('公司')
            if not phone:
                missing_fields.append('电话')

            if missing_fields:
                return jsonify({
                    'success': False,
                    'message': f'缺少必填字段: {", ".join(missing_fields)}'
                }), 400

            # 处理邀请码
            accessible_syllabi = []
            if invitation_code:
                is_valid, syllabus_info, error_msg = syllabus_service.validate_invitation_code(invitation_code)
                if not is_valid:
                    return jsonify({
                        'success': False,
                        'message': error_msg or '邀请码无效'
                    }), 400

                # 增加邀请码使用次数
                syllabus_service.increment_invitation_code_usage(syllabus_info['syllabus_id'])
                accessible_syllabi.append(syllabus_info['syllabus_id'])

            result = auth_service.guest_login(
                name.strip(),
                company.strip(),
                phone.strip(),
                remember_me,
                accessible_syllabi
            )

            return jsonify({'success': True, 'data': result}), 200

    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': f'登录失败: {str(e)}'}), 500


@auth_bp.route('/validate-invitation-code', methods=['POST'])
def validate_invitation_code():
    """
    验证邀请码（公开接口）

    Request Body:
        {
            "code": "CONNECT2026"
        }

    Response:
        成功: {
            "success": true,
            "data": {
                "syllabus_id": "syl-xxxx",
                "syllabus_name": "课程表名称",
                "syllabus_description": "描述"
            }
        }
        失败: {
            "success": false,
            "message": "错误信息"
        }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': '请求数据为空'}), 400

        code = data.get('code', '').strip()
        if not code:
            return jsonify({'success': False, 'message': '邀请码不能为空'}), 400

        is_valid, syllabus_info, error_msg = syllabus_service.validate_invitation_code(code)

        if is_valid:
            return jsonify({'success': True, 'data': syllabus_info}), 200
        else:
            return jsonify({'success': False, 'message': error_msg}), 400

    except Exception as e:
        return jsonify({'success': False, 'message': f'验证失败: {str(e)}'}), 500


@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """
    获取当前用户信息（预留接口）
    """
    # TODO: 实现获取当前用户信息
    return jsonify({'success': False, 'message': '功能开发中'}), 501


@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """
    刷新 Token（预留接口）
    """
    # TODO: 实现 Token 刷新
    return jsonify({'success': False, 'message': '功能开发中'}), 501


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    登出（预留接口）
    """
    # TODO: 实现登出
    return jsonify({'success': True, 'message': '已登出'}), 200
