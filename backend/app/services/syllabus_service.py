"""课程表管理服务"""
import os
import json
import uuid
import secrets
import string
from datetime import datetime
from typing import Optional, List, Tuple


class SyllabusService:
    """课程表管理服务"""

    def __init__(self):
        # 数据目录路径
        self.data_dir = os.getenv('DATA_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data'))
        self.syllabi_json_path = os.path.join(self.data_dir, 'syllabi.json')
        self.user_groups_json_path = os.path.join(self.data_dir, 'user_groups.json')

        # 确保目录存在
        os.makedirs(self.data_dir, exist_ok=True)

    def _load_syllabi(self) -> dict:
        """加载课程表列表"""
        if os.path.exists(self.syllabi_json_path):
            with open(self.syllabi_json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'syllabi': []}

    def _save_syllabi(self, data: dict):
        """保存课程表列表"""
        with open(self.syllabi_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_user_groups(self) -> dict:
        """加载用户组列表"""
        if os.path.exists(self.user_groups_json_path):
            with open(self.user_groups_json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'user_groups': []}

    def _get_user_group_ids(self, user_id: str) -> list:
        """获取用户所属的用户组ID列表"""
        data = self._load_user_groups()
        user_groups = []

        # 提取员工ID数字部分（emp_5 -> 5）
        check_ids = [user_id]
        if user_id.startswith('emp_'):
            check_ids.append(user_id[4:])  # 也检查不带前缀的ID

        for group in data.get('user_groups', []):
            member_ids = group.get('member_ids', [])
            if any(uid in member_ids for uid in check_ids):
                user_groups.append(group['id'])
        return user_groups

    def get_all_syllabi(self, include_unpublished: bool = False) -> list:
        """获取所有课程表"""
        data = self._load_syllabi()
        syllabi = data.get('syllabi', [])
        if not include_unpublished:
            syllabi = [s for s in syllabi if s.get('is_published', False)]
        return sorted(syllabi, key=lambda x: x.get('created_at', ''), reverse=True)

    def get_syllabus(self, syllabus_id: str) -> dict:
        """获取单个课程表"""
        data = self._load_syllabi()
        syllabi = data.get('syllabi', [])
        for syllabus in syllabi:
            if syllabus.get('id') == syllabus_id:
                return syllabus
        return None

    def create_syllabus(
        self,
        name: str,
        description: str = '',
        cover_image_url: str = ''
    ) -> dict:
        """
        创建新课程表

        Args:
            name: 课程表名称
            description: 课程表描述
            cover_image_url: 封面图片URL

        Returns:
            新创建的课程表信息
        """
        # 生成课程表ID
        syllabus_id = f"syl-{uuid.uuid4().hex[:8]}"

        # 创建课程表数据
        syllabus = {
            'id': syllabus_id,
            'name': name,
            'description': description,
            'cover_image_url': cover_image_url,
            'course_sequence': [],
            'access_type': 'public',
            'access_rules': {
                'allow_guests': True,
                'allow_employees': True,
                'allowed_user_groups': [],
                'allowed_users': []
            },
            'time_config': {
                'type': 'permanent',
                'start_date': None,
                'end_date': None
            },
            'is_published': False,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }

        # 保存到列表
        data = self._load_syllabi()
        data['syllabi'].append(syllabus)
        self._save_syllabi(data)

        return syllabus

    def update_syllabus(self, syllabus_id: str, updates: dict) -> dict:
        """
        更新课程表信息

        Args:
            syllabus_id: 课程表 ID
            updates: 要更新的字段

        Returns:
            更新后的课程表信息
        """
        data = self._load_syllabi()
        syllabi = data.get('syllabi', [])

        for i, syllabus in enumerate(syllabi):
            if syllabus.get('id') == syllabus_id:
                # 允许更新的字段
                allowed_fields = [
                    'name', 'description', 'cover_image_url',
                    'course_sequence', 'access_type', 'access_rules',
                    'time_config', 'is_published'
                ]
                for field in allowed_fields:
                    if field in updates:
                        syllabus[field] = updates[field]

                syllabus['updated_at'] = datetime.now().isoformat()
                data['syllabi'][i] = syllabus
                self._save_syllabi(data)
                return syllabus

        return None

    def delete_syllabus(self, syllabus_id: str) -> bool:
        """
        删除课程表

        Args:
            syllabus_id: 课程表 ID

        Returns:
            是否删除成功
        """
        data = self._load_syllabi()
        syllabi = data.get('syllabi', [])

        # 查找并删除
        for i, syllabus in enumerate(syllabi):
            if syllabus.get('id') == syllabus_id:
                del syllabi[i]
                data['syllabi'] = syllabi
                self._save_syllabi(data)
                return True

        return False

    def publish_syllabus(self, syllabus_id: str) -> dict:
        """发布课程表"""
        return self.update_syllabus(syllabus_id, {'is_published': True})

    def unpublish_syllabus(self, syllabus_id: str) -> dict:
        """取消发布课程表"""
        return self.update_syllabus(syllabus_id, {'is_published': False})

    def add_course_to_syllabus(
        self,
        syllabus_id: str,
        course_id: str,
        is_optional: bool = False
    ) -> dict:
        """
        添加课程到课程表

        Args:
            syllabus_id: 课程表 ID
            course_id: 课程 ID
            is_optional: 是否为可选课程

        Returns:
            更新后的课程表
        """
        syllabus = self.get_syllabus(syllabus_id)
        if not syllabus:
            return None

        course_sequence = syllabus.get('course_sequence', [])

        # 检查是否已存在
        for item in course_sequence:
            if item.get('course_id') == course_id:
                return syllabus  # 已存在，直接返回

        # 添加课程
        next_order = len(course_sequence) + 1
        course_sequence.append({
            'course_id': course_id,
            'order': next_order,
            'is_optional': is_optional
        })

        return self.update_syllabus(syllabus_id, {'course_sequence': course_sequence})

    def remove_course_from_syllabus(self, syllabus_id: str, course_id: str) -> dict:
        """
        从课程表移除课程

        Args:
            syllabus_id: 课程表 ID
            course_id: 课程 ID

        Returns:
            更新后的课程表
        """
        syllabus = self.get_syllabus(syllabus_id)
        if not syllabus:
            return None

        course_sequence = syllabus.get('course_sequence', [])
        course_sequence = [item for item in course_sequence if item.get('course_id') != course_id]

        # 重新排序
        for i, item in enumerate(course_sequence):
            item['order'] = i + 1

        return self.update_syllabus(syllabus_id, {'course_sequence': course_sequence})

    def reorder_courses_in_syllabus(self, syllabus_id: str, course_ids: list) -> dict:
        """
        重新排序课程表中的课程

        Args:
            syllabus_id: 课程表 ID
            course_ids: 课程 ID 列表 (按新顺序排列)

        Returns:
            更新后的课程表
        """
        syllabus = self.get_syllabus(syllabus_id)
        if not syllabus:
            return None

        course_sequence = syllabus.get('course_sequence', [])
        course_map = {item['course_id']: item for item in course_sequence}

        # 按新顺序重建
        new_sequence = []
        for order, course_id in enumerate(course_ids, 1):
            if course_id in course_map:
                item = course_map[course_id]
                item['order'] = order
                new_sequence.append(item)

        return self.update_syllabus(syllabus_id, {'course_sequence': new_sequence})

    def _is_time_valid(self, time_config: dict) -> bool:
        """检查时间配置是否有效"""
        if time_config.get('type') == 'permanent':
            return True

        now = datetime.now()
        start_date = time_config.get('start_date')
        end_date = time_config.get('end_date')

        if start_date:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            if now < start:
                return False

        if end_date:
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            if now > end:
                return False

        return True

    def can_access_syllabus(self, user_info: dict, syllabus: dict) -> bool:
        """
        检查用户是否可以访问课程表

        Args:
            user_info: 用户信息 {user_id, user_type, accessible_syllabi, ...}
            syllabus: 课程表信息

        Returns:
            是否可以访问
        """
        # 未发布的课程表不可访问
        if not syllabus.get('is_published', False):
            return False

        # 检查时间
        time_config = syllabus.get('time_config', {})
        if not self._is_time_valid(time_config):
            return False

        # 公开访问
        if syllabus.get('access_type') == 'public':
            return True

        # 受限访问
        rules = syllabus.get('access_rules', {})
        user_type = user_info.get('user_type', 'guest')
        user_id = user_info.get('user_id', '')
        syllabus_id = syllabus.get('id')

        # 检查客人通过邀请码获得的访问权限
        accessible_syllabi = user_info.get('accessible_syllabi', [])
        if syllabus_id and syllabus_id in accessible_syllabi:
            return True

        # 允许客人（无邀请码限制时直接允许，有邀请码限制时需要通过上面的检查）
        if rules.get('allow_guests') and user_type == 'guest':
            # 检查是否启用了邀请码限制
            invitation = rules.get('guest_invitation', {})
            if invitation.get('enabled'):
                # 需要通过邀请码访问
                return False
            return True

        # 允许员工
        if rules.get('allow_employees') and user_type == 'employee':
            return True

        # 指定用户
        if user_id in rules.get('allowed_users', []):
            return True

        # 用户组
        user_groups = self._get_user_group_ids(user_id)
        allowed_groups = rules.get('allowed_user_groups', [])
        if any(g in allowed_groups for g in user_groups):
            return True

        return False

    def get_accessible_syllabi(self, user_info: dict) -> list:
        """
        获取用户可访问的课程表列表

        Args:
            user_info: 用户信息 {user_id, user_type, ...}

        Returns:
            可访问的课程表列表
        """
        all_syllabi = self.get_all_syllabi(include_unpublished=False)
        return [s for s in all_syllabi if self.can_access_syllabus(user_info, s)]

    # ==================== 邀请码管理 ====================

    def _generate_random_code(self, length: int = 8) -> str:
        """生成随机邀请码"""
        chars = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))

    def generate_invitation_code(
        self,
        syllabus_id: str,
        expires_at: Optional[str] = None,
        max_uses: Optional[int] = None,
        custom_code: Optional[str] = None
    ) -> dict:
        """
        生成邀请码

        Args:
            syllabus_id: 课程表 ID
            expires_at: 过期时间 (ISO 格式)
            max_uses: 最大使用次数 (None 表示无限制)
            custom_code: 自定义邀请码 (可选)

        Returns:
            邀请码信息
        """
        syllabus = self.get_syllabus(syllabus_id)
        if not syllabus:
            return None

        # 检查是否允许客人访问
        access_rules = syllabus.get('access_rules', {})
        if not access_rules.get('allow_guests', True):
            raise ValueError('课程表不允许客人访问，无法生成邀请码')

        # 生成或使用自定义邀请码
        if custom_code:
            code = custom_code.upper().strip()
            # 验证自定义邀请码是否已被使用
            if self._is_code_in_use(code, syllabus_id):
                raise ValueError('邀请码已被其他课程表使用')
        else:
            code = self._generate_random_code()
            # 确保不重复
            while self._is_code_in_use(code, syllabus_id):
                code = self._generate_random_code()

        # 创建邀请码配置
        guest_invitation = {
            'enabled': True,
            'code': code,
            'expires_at': expires_at,
            'created_at': datetime.now().isoformat(),
            'max_uses': max_uses,
            'current_uses': 0
        }

        # 更新课程表
        access_rules['guest_invitation'] = guest_invitation
        self.update_syllabus(syllabus_id, {'access_rules': access_rules})

        return guest_invitation

    def _is_code_in_use(self, code: str, exclude_syllabus_id: Optional[str] = None) -> bool:
        """检查邀请码是否已被使用"""
        data = self._load_syllabi()
        for syllabus in data.get('syllabi', []):
            if exclude_syllabus_id and syllabus.get('id') == exclude_syllabus_id:
                continue
            invitation = syllabus.get('access_rules', {}).get('guest_invitation', {})
            if invitation.get('enabled') and invitation.get('code', '').upper() == code.upper():
                return True
        return False

    def delete_invitation_code(self, syllabus_id: str) -> bool:
        """
        删除邀请码

        Args:
            syllabus_id: 课程表 ID

        Returns:
            是否删除成功
        """
        syllabus = self.get_syllabus(syllabus_id)
        if not syllabus:
            return False

        access_rules = syllabus.get('access_rules', {})
        if 'guest_invitation' in access_rules:
            del access_rules['guest_invitation']
            self.update_syllabus(syllabus_id, {'access_rules': access_rules})

        return True

    def get_invitation_code_info(self, syllabus_id: str) -> Optional[dict]:
        """
        获取邀请码信息

        Args:
            syllabus_id: 课程表 ID

        Returns:
            邀请码信息，包含 is_expired 和 is_exhausted 状态
        """
        syllabus = self.get_syllabus(syllabus_id)
        if not syllabus:
            return None

        invitation = syllabus.get('access_rules', {}).get('guest_invitation')
        if not invitation:
            return None

        # 添加状态信息
        result = invitation.copy()
        result['is_expired'] = self._is_invitation_expired(invitation)
        result['is_exhausted'] = self._is_invitation_exhausted(invitation)

        return result

    def _is_invitation_expired(self, invitation: dict) -> bool:
        """检查邀请码是否已过期"""
        expires_at = invitation.get('expires_at')
        if not expires_at:
            return False
        try:
            expiry = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            return datetime.now().astimezone() > expiry
        except (ValueError, TypeError):
            return False

    def _is_invitation_exhausted(self, invitation: dict) -> bool:
        """检查邀请码是否已用尽"""
        max_uses = invitation.get('max_uses')
        if max_uses is None:
            return False
        return invitation.get('current_uses', 0) >= max_uses

    def validate_invitation_code(self, code: str) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        验证邀请码

        Args:
            code: 邀请码

        Returns:
            (是否有效, 课程表信息, 错误信息)
        """
        if not code:
            return False, None, '邀请码不能为空'

        code = code.upper().strip()
        data = self._load_syllabi()

        for syllabus in data.get('syllabi', []):
            # 跳过未发布的课程表
            if not syllabus.get('is_published', False):
                continue

            invitation = syllabus.get('access_rules', {}).get('guest_invitation', {})
            if not invitation.get('enabled'):
                continue

            if invitation.get('code', '').upper() == code:
                # 检查是否过期
                if self._is_invitation_expired(invitation):
                    return False, None, '邀请码已过期'

                # 检查是否用尽
                if self._is_invitation_exhausted(invitation):
                    return False, None, '邀请码使用次数已达上限'

                # 检查时间配置
                time_config = syllabus.get('time_config', {})
                if not self._is_time_valid(time_config):
                    return False, None, '课程表已过期或尚未开始'

                return True, {
                    'syllabus_id': syllabus.get('id'),
                    'syllabus_name': syllabus.get('name'),
                    'syllabus_description': syllabus.get('description', '')
                }, None

        return False, None, '邀请码无效'

    def increment_invitation_code_usage(self, syllabus_id: str) -> bool:
        """
        增加邀请码使用次数

        Args:
            syllabus_id: 课程表 ID

        Returns:
            是否增加成功
        """
        syllabus = self.get_syllabus(syllabus_id)
        if not syllabus:
            return False

        access_rules = syllabus.get('access_rules', {})
        invitation = access_rules.get('guest_invitation', {})

        if not invitation.get('enabled'):
            return False

        invitation['current_uses'] = invitation.get('current_uses', 0) + 1
        access_rules['guest_invitation'] = invitation

        self.update_syllabus(syllabus_id, {'access_rules': access_rules})
        return True


syllabus_service = SyllabusService()
