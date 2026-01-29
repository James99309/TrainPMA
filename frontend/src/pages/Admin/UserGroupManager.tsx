import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import adminApi from '../../services/adminApi';
import type { UserGroup, UserBasicInfo } from '../../types';

export function UserGroupManager() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  // Member management state
  const [showMemberEditor, setShowMemberEditor] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [allUsers, setAllUsers] = useState<UserBasicInfo[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);

  // Load groups
  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getUserGroups();
      setGroups(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load user groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('用户组名称不能为空');
      return;
    }

    setSaving(true);
    try {
      if (editingGroup) {
        await adminApi.updateUserGroup(editingGroup.id, formData);
      } else {
        await adminApi.createUserGroup(formData);
      }
      await loadGroups();
      setShowForm(false);
      setEditingGroup(null);
      setFormData({ name: '', description: '' });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (groupId: string) => {
    if (!confirm('确定要删除此用户组吗？')) return;

    try {
      await adminApi.deleteUserGroup(groupId);
      await loadGroups();
    } catch (err: any) {
      setError(err.message || 'Failed to delete group');
    }
  };

  // Handle edit
  const handleEdit = (group: UserGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
    });
    setShowForm(true);
  };

  // Open member editor and load all users
  const openMemberEditor = async (group: UserGroup) => {
    setSelectedGroup(group);
    setFilterText('');
    setSelectedUserIds(new Set());
    setShowMemberEditor(true);

    // Load all users if not already loaded
    if (allUsers.length === 0) {
      setLoadingUsers(true);
      try {
        const users = await adminApi.getAllUsers();
        setAllUsers(users);
      } catch (err: any) {
        setError(err.message || 'Failed to load users');
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Select all filtered users (not already members)
  const selectAllFiltered = () => {
    const filteredUsers = getFilteredUsers();
    const newSelected = new Set(selectedUserIds);
    filteredUsers.forEach((user) => {
      const isMember = selectedGroup?.member_ids.includes(user.user_id) ||
        (!!user.legacy_user_id && selectedGroup?.member_ids.includes(user.legacy_user_id));
      if (!isMember) {
        newSelected.add(user.user_id);
      }
    });
    setSelectedUserIds(newSelected);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  // Build a lookup map keyed by both user_id and legacy_user_id
  const userMap = useMemo(() => {
    const map = new Map<string, UserBasicInfo>();
    allUsers.forEach((u) => {
      map.set(u.user_id, u);
      if (u.legacy_user_id) map.set(u.legacy_user_id, u);
    });
    return map;
  }, [allUsers]);

  // Get filtered users based on filterText
  const getFilteredUsers = () => {
    if (!filterText.trim()) return allUsers;
    const lowerFilter = filterText.toLowerCase();
    return allUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(lowerFilter) ||
        (user.company && user.company.toLowerCase().includes(lowerFilter)) ||
        (user.phone && user.phone.includes(filterText))
    );
  };

  // Handle batch add members
  const handleAddSelectedMembers = async () => {
    if (!selectedGroup || selectedUserIds.size === 0) return;

    setAddingMembers(true);
    try {
      const userIdsArray = Array.from(selectedUserIds);
      const updated = await adminApi.addMembersToGroup(selectedGroup.id, userIdsArray);
      setSelectedGroup(updated);
      // Update the groups list
      setGroups((prev) =>
        prev.map((g) => (g.id === updated.id ? updated : g))
      );
      // Clear selection after successful add
      setSelectedUserIds(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to add members');
    } finally {
      setAddingMembers(false);
    }
  };

  // Handle remove member
  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      const updated = await adminApi.removeMemberFromGroup(selectedGroup.id, userId);
      setSelectedGroup(updated);
      // Update the groups list
      setGroups((prev) =>
        prev.map((g) => (g.id === updated.id ? updated : g))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            用户组管理
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            管理用户组，用于访问权限控制
          </p>
        </div>
        <button
          onClick={() => {
            setEditingGroup(null);
            setFormData({ name: '', description: '' });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>新建用户组</span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Group Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {editingGroup ? '编辑用户组' : '新建用户组'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    placeholder="例如：销售团队"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    rows={3}
                    placeholder="用户组的简要描述"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? '保存中...' : editingGroup ? '更新' : '创建'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member Editor Modal */}
      <AnimatePresence>
        {showMemberEditor && selectedGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowMemberEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                管理成员: {selectedGroup.name}
              </h3>

              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                {/* Current members */}
                <div className="flex flex-col min-h-0">
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    当前成员 ({selectedGroup.member_ids.length})
                  </h4>
                  {selectedGroup.member_ids.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                      暂无成员
                    </p>
                  ) : (
                    <div className="space-y-2 overflow-y-auto flex-1">
                      {selectedGroup.member_ids.map((userId) => {
                        // Find user info using userMap (supports both new and legacy IDs)
                        const userInfo = userMap.get(userId);
                        return (
                          <div
                            key={userId}
                            className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-700 dark:text-gray-300 block truncate">
                                {userInfo?.name || userId}
                              </span>
                              {userInfo?.company && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                                  {userInfo.company}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveMember(userId)}
                              className="text-red-500 hover:text-red-700 text-sm flex-shrink-0 ml-2"
                            >
                              移除
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* User list with multi-select */}
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300">
                      添加成员
                    </h4>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={selectAllFiltered}
                        className="text-indigo-500 hover:text-indigo-700"
                      >
                        全选
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button
                        onClick={clearSelection}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      >
                        清除
                      </button>
                    </div>
                  </div>

                  {/* Filter input */}
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="筛选用户..."
                  />

                  {/* User list */}
                  {loadingUsers ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-1 overflow-y-auto flex-1">
                      {getFilteredUsers().map((user) => {
                        const isMember = selectedGroup.member_ids.includes(user.user_id) ||
                          (!!user.legacy_user_id && selectedGroup.member_ids.includes(user.legacy_user_id));
                        const isSelected = selectedUserIds.has(user.user_id);

                        return (
                          <label
                            key={user.user_id}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                              isMember
                                ? 'bg-green-50 dark:bg-green-900/20 opacity-60'
                                : isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-900/30'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isMember || isSelected}
                              disabled={isMember}
                              onChange={() => !isMember && toggleUserSelection(user.user_id)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-700 dark:text-gray-300 block truncate">
                                {user.name}
                                {isMember && (
                                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                    已在组内
                                  </span>
                                )}
                              </span>
                              {user.company && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                                  {user.company}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                      {getFilteredUsers().length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                          {filterText ? '未找到匹配用户' : '暂无用户'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer with actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedUserIds.size > 0 && (
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      已选择 {selectedUserIds.size} 人
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  {selectedUserIds.size > 0 && (
                    <button
                      onClick={handleAddSelectedMembers}
                      disabled={addingMembers}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {addingMembers ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          添加中...
                        </>
                      ) : (
                        <>添加选中 ({selectedUserIds.size})</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setShowMemberEditor(false)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    完成
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <span className="text-4xl mb-4 block">👥</span>
          <p className="text-gray-500 dark:text-gray-400">暂无用户组</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            创建用户组来管理访问权限
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <motion.div
              key={group.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {group.name}
                  </h3>
                  {group.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {group.description}
                    </p>
                  )}
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-2">
                    {group.member_ids.length} 位成员
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => openMemberEditor(group)}
                  className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  管理成员
                </button>
                <button
                  onClick={() => handleEdit(group)}
                  className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(group.id)}
                  className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  删除
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UserGroupManager;
