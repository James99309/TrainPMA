"""
认证服务
支持客人登录和员工登录两种模式
"""
from app.services.sheets_service import sheets_service
from app.services.pma_api_service import verify_employee
from app.services.progress_service import progress_service
from app.utils import generate_token, validate_phone, validate_name, validate_company


class AuthService:
    """认证服务类"""

    @staticmethod
    def guest_login(
        name: str,
        company: str,
        phone: str,
        remember_me: bool = False,
        accessible_syllabi: list = None
    ) -> dict:
        """
        客人登录 - 使用姓名、公司、电话登录

        Args:
            name: 姓名
            company: 公司名称
            phone: 手机号码
            remember_me: 是否记住登录状态
            accessible_syllabi: 通过邀请码获得的课程表访问权限列表

        Returns:
            {
                'user_id': str,
                'name': str,
                'company': str,
                'phone': str,
                'user_type': 'guest',
                'token': str,
                'remember_me': bool,
                'accessible_syllabi': list
            }
        """
        # 验证输入
        if not validate_name(name):
            raise ValueError('姓名格式不正确')
        if not validate_company(company):
            raise ValueError('企业名称格式不正确')
        if not validate_phone(phone):
            raise ValueError('手机号格式不正确')

        # 查找或创建用户
        existing = sheets_service.find_user_by_phone(phone)
        if existing:
            user_id = existing.get('user_id')
        else:
            new_user = sheets_service.create_user(name, company, phone)
            user_id = new_user.get('user_id')

        # 获取用户信息
        user = sheets_service.get_user_by_id(user_id)

        # 生成 Token，包含 accessible_syllabi 信息
        token = generate_token(user_id, user_type='guest', accessible_syllabi=accessible_syllabi or [])

        # 获取用户进度
        print(f"========== GUEST LOGIN DEBUG (backend) ==========")
        print(f"[GuestLogin] Getting progress for user_id: {user_id}")
        progress = progress_service.get_user_progress(user_id)
        print(f"[GuestLogin] Progress from DB: {progress}")
        if progress is None:
            print(f"[GuestLogin] No progress found, using default")
            progress = progress_service.get_default_progress()
        print(f"[GuestLogin] Returning progress: hearts={progress.get('hearts')}, totalXP={progress.get('totalXP')}, streak={progress.get('streak')}")
        print(f"========== GUEST LOGIN DEBUG END ==========")

        return {
            'user_id': user_id,
            'name': user.get('name'),
            'company': user.get('company'),
            'phone': user.get('phone'),
            'user_type': 'guest',
            'token': token,
            'remember_me': remember_me,
            'progress': progress,
            'accessible_syllabi': accessible_syllabi or []
        }

    @staticmethod
    def employee_login(username: str, password: str, remember_me: bool = False) -> dict:
        """
        员工登录 - 通过 PMA 系统验证

        Args:
            username: 员工账户
            password: 密码
            remember_me: 是否记住登录状态

        Returns:
            成功: {
                'success': True,
                'data': {
                    'user_id': str,
                    'name': str,
                    'company': str,
                    'user_type': 'employee',
                    'employee_info': {...},
                    'token': str,
                    'remember_me': bool
                }
            }
            失败: {
                'success': False,
                'message': str
            }
        """
        # 验证输入
        if not username or not username.strip():
            return {'success': False, 'message': '账户不能为空'}
        if not password:
            return {'success': False, 'message': '密码不能为空'}

        username = username.strip()

        # 调用 PMA API 验证
        pma_result = verify_employee(username, password, remember_me)

        if not pma_result['success']:
            return pma_result

        employee_data = pma_result['data']

        # 生成本系统 Token，使用 emp_ 前缀区分员工
        user_id = f"emp_{employee_data['employee_id']}"
        token = generate_token(user_id, user_type='employee')

        # 获取用户进度
        print(f"========== LOGIN DEBUG (backend) ==========")
        print(f"[Login] Getting progress for user_id: {user_id}")
        progress = progress_service.get_user_progress(user_id)
        print(f"[Login] Progress from DB: {progress}")
        if progress is None:
            print(f"[Login] No progress found, using default")
            progress = progress_service.get_default_progress()
        print(f"[Login] Returning progress: hearts={progress.get('hearts')}, totalXP={progress.get('totalXP')}, streak={progress.get('streak')}")
        print(f"========== LOGIN DEBUG END ==========")

        return {
            'success': True,
            'data': {
                'user_id': user_id,
                'name': employee_data['real_name'],
                'company': employee_data['company'],
                'user_type': 'employee',
                'employee_info': {
                    'employee_id': employee_data['employee_id'],
                    'username': employee_data['username'],
                    'email': employee_data.get('email'),
                    'phone': employee_data.get('phone')
                },
                'token': token,
                'remember_me': remember_me,
                'progress': progress
            }
        }

    # 保持向后兼容的 login 方法
    @staticmethod
    def login(name: str, company: str, phone: str) -> dict:
        """
        向后兼容的登录方法 - 等同于客人登录
        """
        result = AuthService.guest_login(name, company, phone)
        # 移除 user_type 和 remember_me 以保持旧 API 格式
        return {
            'user_id': result['user_id'],
            'name': result['name'],
            'company': result['company'],
            'phone': result['phone'],
            'token': result['token']
        }


auth_service = AuthService()
