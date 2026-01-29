"""用户组管理服务 - Google Sheets 存储"""
import json
import uuid
from datetime import datetime
from typing import List, Optional


class UserGroupService:
    """用户组管理服务 (Google Sheets 后端)"""

    HEADERS = ['group_id', 'name', 'description', 'member_ids', 'created_at', 'updated_at']

    def __init__(self):
        from app.services.sheets_service import sheets_service
        self._sheets = sheets_service

    @property
    def sheet(self):
        return self._sheets.user_groups_sheet

    # ---- 缓存代理 ----

    def _get_cache(self, key='default'):
        return self._sheets._get_cache('user_groups', key)

    def _set_cache(self, key, data):
        self._sheets._set_cache('user_groups', key, data)

    def _clear_cache(self):
        self._sheets.clear_cache('user_groups')

    # ---- 内部工具 ----

    def _row_to_group(self, row: dict) -> dict:
        """将 Sheets 行数据转为 group dict（兼容旧接口的 'id' 字段）"""
        member_ids_raw = row.get('member_ids', '[]')
        if isinstance(member_ids_raw, str) and member_ids_raw.strip():
            try:
                member_ids = json.loads(member_ids_raw)
            except (json.JSONDecodeError, ValueError):
                member_ids = []
        else:
            member_ids = []

        return {
            'id': row.get('group_id', ''),
            'name': row.get('name', ''),
            'description': row.get('description', ''),
            'member_ids': member_ids,
            'created_at': row.get('created_at', ''),
            'updated_at': row.get('updated_at', ''),
        }

    def _find_row_index(self, group_id: str) -> Optional[int]:
        """找到 group_id 所在行号（1-based，含表头）。找不到返回 None。"""
        rows = self.sheet.get_all_values()
        for idx, row in enumerate(rows):
            if idx == 0:
                continue
            if row and row[0] == group_id:
                return idx + 1  # gspread 行号从 1 开始
        return None

    def _get_all_records(self) -> list:
        """带缓存地获取所有行记录"""
        cached = self._get_cache('all')
        if cached is not None:
            return cached
        try:
            rows = self.sheet.get_all_records()
        except (IndexError, Exception):
            rows = []
        self._set_cache('all', rows)
        return rows

    # ---- 公开 API（保持原签名） ----

    def get_all_user_groups(self) -> list:
        """获取所有用户组"""
        rows = self._get_all_records()
        return [self._row_to_group(r) for r in rows]

    def get_user_group(self, group_id: str) -> Optional[dict]:
        """获取单个用户组"""
        for group in self.get_all_user_groups():
            if group['id'] == group_id:
                return group
        return None

    def create_user_group(self, name: str, description: str = '') -> dict:
        """创建新用户组"""
        group_id = f"grp-{uuid.uuid4().hex[:8]}"
        now = datetime.now().isoformat()
        member_ids_json = '[]'

        self.sheet.append_row([group_id, name, description, member_ids_json, now, now])
        self._clear_cache()

        return {
            'id': group_id,
            'name': name,
            'description': description,
            'member_ids': [],
            'created_at': now,
            'updated_at': now,
        }

    def update_user_group(self, group_id: str, updates: dict) -> Optional[dict]:
        """更新用户组信息（名称、描述）"""
        row_idx = self._find_row_index(group_id)
        if row_idx is None:
            return None

        allowed_fields = {'name': 2, 'description': 3}  # 列号（1-based）
        now = datetime.now().isoformat()

        for field, col in allowed_fields.items():
            if field in updates:
                self.sheet.update_cell(row_idx, col, updates[field])

        self.sheet.update_cell(row_idx, 6, now)  # updated_at
        self._clear_cache()

        return self.get_user_group(group_id)

    def delete_user_group(self, group_id: str) -> bool:
        """删除用户组"""
        row_idx = self._find_row_index(group_id)
        if row_idx is None:
            return False

        self.sheet.delete_rows(row_idx)
        self._clear_cache()
        return True

    def _update_member_ids(self, group_id: str, member_ids: list) -> Optional[dict]:
        """更新指定组的 member_ids 列"""
        row_idx = self._find_row_index(group_id)
        if row_idx is None:
            return None

        now = datetime.now().isoformat()
        self.sheet.update_cell(row_idx, 4, json.dumps(member_ids, ensure_ascii=False))
        self.sheet.update_cell(row_idx, 6, now)
        self._clear_cache()

        return self.get_user_group(group_id)

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
