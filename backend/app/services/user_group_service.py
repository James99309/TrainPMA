"""用户组管理服务 - PostgreSQL 存储"""
import json
import uuid
from datetime import datetime
from typing import List, Optional

from app.models.base import db
from app.models.user_group import UserGroup


class UserGroupService:
    """用户组管理服务 (PostgreSQL 后端)"""

    def __init__(self):
        pass

    # ---- 公开 API（保持原签名） ----

    def get_all_user_groups(self) -> list:
        """获取所有用户组"""
        groups = UserGroup.query.all()
        return [g.to_dict() for g in groups]

    def get_user_group(self, group_id: str) -> Optional[dict]:
        """获取单个用户组"""
        group = db.session.get(UserGroup, group_id)
        if group is None:
            return None
        return group.to_dict()

    def create_user_group(self, name: str, description: str = '') -> dict:
        """创建新用户组"""
        group_id = f"grp-{uuid.uuid4().hex[:8]}"
        now = datetime.now()

        group = UserGroup(
            group_id=group_id,
            name=name,
            description=description,
            member_ids=json.dumps([]),
            created_at=now,
            updated_at=now
        )
        db.session.add(group)
        db.session.commit()

        return group.to_dict()

    def update_user_group(self, group_id: str, updates: dict) -> Optional[dict]:
        """更新用户组信息（名称、描述）"""
        group = db.session.get(UserGroup, group_id)
        if group is None:
            return None

        if 'name' in updates:
            group.name = updates['name']
        if 'description' in updates:
            group.description = updates['description']

        group.updated_at = datetime.now()
        db.session.commit()

        return group.to_dict()

    def delete_user_group(self, group_id: str) -> bool:
        """删除用户组"""
        group = db.session.get(UserGroup, group_id)
        if group is None:
            return False

        db.session.delete(group)
        db.session.commit()
        return True

    def _update_member_ids(self, group_id: str, member_ids: list) -> Optional[dict]:
        """更新指定组的 member_ids 列"""
        group = db.session.get(UserGroup, group_id)
        if group is None:
            return None

        group.set_member_ids(member_ids)
        group.updated_at = datetime.now()
        db.session.commit()

        return group.to_dict()

    def add_member(self, group_id: str, user_id: str) -> Optional[dict]:
        """添加成员到用户组"""
        group = self.get_user_group(group_id)
        if group is None:
            return None

        member_ids = group.get('member_ids', [])
        if user_id not in member_ids:
            member_ids.append(user_id)
            return self._update_member_ids(group_id, member_ids)
        return group

    def remove_member(self, group_id: str, user_id: str) -> Optional[dict]:
        """从用户组移除成员"""
        group = self.get_user_group(group_id)
        if group is None:
            return None

        member_ids = group.get('member_ids', [])
        if user_id in member_ids:
            member_ids.remove(user_id)
            return self._update_member_ids(group_id, member_ids)
        return group

    def add_members_batch(self, group_id: str, user_ids: List[str]) -> Optional[dict]:
        """批量添加成员到用户组"""
        group = self.get_user_group(group_id)
        if group is None:
            return None

        member_ids = set(group.get('member_ids', []))
        member_ids.update(user_ids)
        return self._update_member_ids(group_id, list(member_ids))

    def get_user_groups_for_user(self, user_id: str) -> List[dict]:
        """获取用户所属的所有用户组"""
        groups = self.get_all_user_groups()
        return [g for g in groups if user_id in g.get('member_ids', [])]

    def get_user_group_ids_for_user(self, user_id: str) -> List[str]:
        """获取用户所属的用户组ID列表"""
        groups = self.get_user_groups_for_user(user_id)
        return [g['id'] for g in groups]


user_group_service = UserGroupService()
