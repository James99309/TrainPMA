"""用户组管理服务"""
import os
import json
import uuid
from datetime import datetime
from typing import List, Optional


class UserGroupService:
    """用户组管理服务"""

    def __init__(self):
        # 数据目录路径
        self.data_dir = os.getenv('DATA_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data'))
        self.user_groups_json_path = os.path.join(self.data_dir, 'user_groups.json')

        # 确保目录存在
        os.makedirs(self.data_dir, exist_ok=True)

    def _load_user_groups(self) -> dict:
        """加载用户组列表"""
        if os.path.exists(self.user_groups_json_path):
            with open(self.user_groups_json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'user_groups': []}

    def _save_user_groups(self, data: dict):
        """保存用户组列表"""
        with open(self.user_groups_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_all_user_groups(self) -> list:
        """获取所有用户组"""
        data = self._load_user_groups()
        return data.get('user_groups', [])

    def get_user_group(self, group_id: str) -> Optional[dict]:
        """获取单个用户组"""
        groups = self.get_all_user_groups()
        for group in groups:
            if group.get('id') == group_id:
                return group
        return None

    def create_user_group(self, name: str, description: str = '') -> dict:
        """
        创建新用户组

        Args:
            name: 用户组名称
            description: 用户组描述

        Returns:
            新创建的用户组信息
        """
        # 生成用户组ID
        group_id = f"grp-{uuid.uuid4().hex[:8]}"

        # 创建用户组数据
        group = {
            'id': group_id,
            'name': name,
            'description': description,
            'member_ids': [],
            'created_at': datetime.now().isoformat()
        }

        # 保存到列表
        data = self._load_user_groups()
        data['user_groups'].append(group)
        self._save_user_groups(data)

        return group

    def update_user_group(self, group_id: str, updates: dict) -> Optional[dict]:
        """
        更新用户组信息

        Args:
            group_id: 用户组 ID
            updates: 要更新的字段

        Returns:
            更新后的用户组信息
        """
        data = self._load_user_groups()
        groups = data.get('user_groups', [])

        for i, group in enumerate(groups):
            if group.get('id') == group_id:
                # 允许更新的字段
                allowed_fields = ['name', 'description']
                for field in allowed_fields:
                    if field in updates:
                        group[field] = updates[field]

                group['updated_at'] = datetime.now().isoformat()
                data['user_groups'][i] = group
                self._save_user_groups(data)
                return group

        return None

    def delete_user_group(self, group_id: str) -> bool:
        """
        删除用户组

        Args:
            group_id: 用户组 ID

        Returns:
            是否删除成功
        """
        data = self._load_user_groups()
        groups = data.get('user_groups', [])

        # 查找并删除
        for i, group in enumerate(groups):
            if group.get('id') == group_id:
                del groups[i]
                data['user_groups'] = groups
                self._save_user_groups(data)
                return True

        return False

    def add_member(self, group_id: str, user_id: str) -> Optional[dict]:
        """
        添加成员到用户组

        Args:
            group_id: 用户组 ID
            user_id: 用户 ID

        Returns:
            更新后的用户组信息
        """
        data = self._load_user_groups()
        groups = data.get('user_groups', [])

        for i, group in enumerate(groups):
            if group.get('id') == group_id:
                member_ids = group.get('member_ids', [])
                if user_id not in member_ids:
                    member_ids.append(user_id)
                    group['member_ids'] = member_ids
                    group['updated_at'] = datetime.now().isoformat()
                    data['user_groups'][i] = group
                    self._save_user_groups(data)
                return group

        return None

    def remove_member(self, group_id: str, user_id: str) -> Optional[dict]:
        """
        从用户组移除成员

        Args:
            group_id: 用户组 ID
            user_id: 用户 ID

        Returns:
            更新后的用户组信息
        """
        data = self._load_user_groups()
        groups = data.get('user_groups', [])

        for i, group in enumerate(groups):
            if group.get('id') == group_id:
                member_ids = group.get('member_ids', [])
                if user_id in member_ids:
                    member_ids.remove(user_id)
                    group['member_ids'] = member_ids
                    group['updated_at'] = datetime.now().isoformat()
                    data['user_groups'][i] = group
                    self._save_user_groups(data)
                return group

        return None

    def add_members_batch(self, group_id: str, user_ids: List[str]) -> Optional[dict]:
        """
        批量添加成员到用户组

        Args:
            group_id: 用户组 ID
            user_ids: 用户 ID 列表

        Returns:
            更新后的用户组信息
        """
        data = self._load_user_groups()
        groups = data.get('user_groups', [])

        for i, group in enumerate(groups):
            if group.get('id') == group_id:
                member_ids = set(group.get('member_ids', []))
                member_ids.update(user_ids)
                group['member_ids'] = list(member_ids)
                group['updated_at'] = datetime.now().isoformat()
                data['user_groups'][i] = group
                self._save_user_groups(data)
                return group

        return None

    def get_user_groups_for_user(self, user_id: str) -> List[dict]:
        """
        获取用户所属的所有用户组

        Args:
            user_id: 用户 ID

        Returns:
            用户所属的用户组列表
        """
        groups = self.get_all_user_groups()
        return [g for g in groups if user_id in g.get('member_ids', [])]

    def get_user_group_ids_for_user(self, user_id: str) -> List[str]:
        """
        获取用户所属的用户组ID列表

        Args:
            user_id: 用户 ID

        Returns:
            用户组ID列表
        """
        groups = self.get_user_groups_for_user(user_id)
        return [g['id'] for g in groups]


user_group_service = UserGroupService()
