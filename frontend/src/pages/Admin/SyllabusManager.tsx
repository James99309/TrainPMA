import { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import adminApi from '../../services/adminApi';
import type { Syllabus, Course, UserGroup } from '../../types';
import { InvitationCodeManager } from '../../components/Syllabus';

export function SyllabusManager() {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState<Syllabus | null>(null);
  const [saving, setSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cover_image_url: '',
  });

  // Course editor state
  const [showCourseEditor, setShowCourseEditor] = useState(false);
  const [selectedSyllabus, setSelectedSyllabus] = useState<Syllabus | null>(null);
  const [syllabusCoursesOrder, setSyllabusCoursesOrder] = useState<string[]>([]);

  // Access editor state
  const [showAccessEditor, setShowAccessEditor] = useState(false);
  const [accessData, setAccessData] = useState({
    access_type: 'public' as 'public' | 'restricted',
    allow_guests: true,
    allow_employees: true,
    allowed_user_groups: [] as string[],
    allowed_users: [] as string[],
    time_type: 'permanent' as 'permanent' | 'limited',
    start_date: '',
    end_date: '',
  });

  // Invitation editor state
  const [showInvitationEditor, setShowInvitationEditor] = useState(false);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const [syllabiData, coursesData, groupsData] = await Promise.all([
        adminApi.getSyllabi(),
        adminApi.getCourses(),
        adminApi.getUserGroups(),
      ]);
      setSyllabi(syllabiData);
      setCourses(coursesData);
      setUserGroups(groupsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('课程表名称不能为空');
      return;
    }

    setSaving(true);
    try {
      if (editingSyllabus) {
        await adminApi.updateSyllabus(editingSyllabus.id, formData);
      } else {
        await adminApi.createSyllabus(formData);
      }
      await loadData();
      setShowForm(false);
      setEditingSyllabus(null);
      setFormData({ name: '', description: '', cover_image_url: '' });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save syllabus');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (syllabusId: string) => {
    if (!confirm('确定要删除此课程表吗？')) return;

    try {
      await adminApi.deleteSyllabus(syllabusId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete syllabus');
    }
  };

  // Handle edit
  const handleEdit = (syllabus: Syllabus) => {
    setEditingSyllabus(syllabus);
    setFormData({
      name: syllabus.name,
      description: syllabus.description || '',
      cover_image_url: syllabus.cover_image_url || '',
    });
    setShowForm(true);
  };

  // Handle publish toggle
  const handlePublishToggle = async (syllabus: Syllabus) => {
    try {
      if (syllabus.is_published) {
        await adminApi.unpublishSyllabus(syllabus.id);
      } else {
        await adminApi.publishSyllabus(syllabus.id);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update publish status');
    }
  };

  // Open course editor
  const openCourseEditor = (syllabus: Syllabus) => {
    setSelectedSyllabus(syllabus);
    setSyllabusCoursesOrder(syllabus.course_sequence.map((c) => c.course_id));
    setShowCourseEditor(true);
  };

  // Handle add course to syllabus
  const handleAddCourse = async (courseId: string) => {
    if (!selectedSyllabus) return;
    try {
      const updated = await adminApi.addCourseToSyllabus(selectedSyllabus.id, courseId);
      setSelectedSyllabus(updated);
      setSyllabusCoursesOrder(updated.course_sequence.map((c) => c.course_id));
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add course');
    }
  };

  // Handle remove course from syllabus
  const handleRemoveCourse = async (courseId: string) => {
    if (!selectedSyllabus) return;
    try {
      const updated = await adminApi.removeCourseFromSyllabus(selectedSyllabus.id, courseId);
      setSelectedSyllabus(updated);
      setSyllabusCoursesOrder(updated.course_sequence.map((c) => c.course_id));
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove course');
    }
  };

  // Handle reorder courses
  const handleReorderCourses = async (newOrder: string[]) => {
    if (!selectedSyllabus) return;
    setSyllabusCoursesOrder(newOrder);
    try {
      const updated = await adminApi.reorderCoursesInSyllabus(selectedSyllabus.id, newOrder);
      setSelectedSyllabus(updated);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to reorder courses');
    }
  };

  // Open access editor
  const openAccessEditor = (syllabus: Syllabus) => {
    setSelectedSyllabus(syllabus);
    setAccessData({
      access_type: syllabus.access_type,
      allow_guests: syllabus.access_rules.allow_guests,
      allow_employees: syllabus.access_rules.allow_employees,
      allowed_user_groups: syllabus.access_rules.allowed_user_groups,
      allowed_users: syllabus.access_rules.allowed_users,
      time_type: syllabus.time_config.type,
      start_date: syllabus.time_config.start_date || '',
      end_date: syllabus.time_config.end_date || '',
    });
    setShowAccessEditor(true);
  };

  // Open invitation editor
  const openInvitationEditor = (syllabus: Syllabus) => {
    setSelectedSyllabus(syllabus);
    setShowInvitationEditor(true);
  };

  // Save access settings
  const handleSaveAccess = async () => {
    if (!selectedSyllabus) return;
    setSaving(true);
    try {
      await adminApi.updateSyllabus(selectedSyllabus.id, {
        access_type: accessData.access_type,
        access_rules: {
          allow_guests: accessData.allow_guests,
          allow_employees: accessData.allow_employees,
          allowed_user_groups: accessData.allowed_user_groups,
          allowed_users: accessData.allowed_users,
        },
        time_config: {
          type: accessData.time_type,
          start_date: accessData.time_type === 'limited' ? accessData.start_date : null,
          end_date: accessData.time_type === 'limited' ? accessData.end_date : null,
        },
      });
      await loadData();
      setShowAccessEditor(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save access settings');
    } finally {
      setSaving(false);
    }
  };

  // Get course by ID
  const getCourse = (courseId: string) => courses.find((c) => c.id === courseId);

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
            课程表管理
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            创建和管理培训课程表，设置课程顺序
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSyllabus(null);
            setFormData({ name: '', description: '', cover_image_url: '' });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>新建课程表</span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Syllabus Form Modal */}
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
                {editingSyllabus ? '编辑课程表' : '新建课程表'}
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
                    placeholder="例如：新员工入职培训"
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
                    placeholder="课程表的简要描述"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    封面图片链接
                  </label>
                  <input
                    type="url"
                    value={formData.cover_image_url}
                    onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    placeholder="https://..."
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
                    {saving ? '保存中...' : editingSyllabus ? '更新' : '创建'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Course Editor Modal */}
      <AnimatePresence>
        {showCourseEditor && selectedSyllabus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCourseEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                管理课程: {selectedSyllabus.name}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Current courses */}
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    已添加课程 (拖拽排序)
                  </h4>
                  {syllabusCoursesOrder.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                      暂未添加课程
                    </p>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={syllabusCoursesOrder}
                      onReorder={handleReorderCourses}
                      className="space-y-2"
                    >
                      {syllabusCoursesOrder.map((courseId) => {
                        const course = getCourse(courseId);
                        return (
                          <Reorder.Item
                            key={courseId}
                            value={courseId}
                            className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between cursor-move"
                          >
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {course?.title || courseId}
                            </span>
                            <button
                              onClick={() => handleRemoveCourse(courseId)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              移除
                            </button>
                          </Reorder.Item>
                        );
                      })}
                    </Reorder.Group>
                  )}
                </div>

                {/* Available courses */}
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    可用课程
                  </h4>
                  <div className="space-y-2">
                    {courses
                      .filter((c) => !syllabusCoursesOrder.includes(c.id))
                      .map((course) => (
                        <div
                          key={course.id}
                          className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {course.title}
                          </span>
                          <button
                            onClick={() => handleAddCourse(course.id)}
                            className="text-indigo-500 hover:text-indigo-700 text-sm"
                          >
                            添加
                          </button>
                        </div>
                      ))}
                    {courses.filter((c) => !syllabusCoursesOrder.includes(c.id)).length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                        所有课程已添加
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowCourseEditor(false)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  完成
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Access Editor Modal */}
      <AnimatePresence>
        {showAccessEditor && selectedSyllabus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAccessEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                访问设置: {selectedSyllabus.name}
              </h3>

              <div className="space-y-4">
                {/* Access Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    访问类型
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={accessData.access_type === 'public'}
                        onChange={() => setAccessData({ ...accessData, access_type: 'public' })}
                        className="mr-2"
                      />
                      公开
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={accessData.access_type === 'restricted'}
                        onChange={() => setAccessData({ ...accessData, access_type: 'restricted' })}
                        className="mr-2"
                      />
                      限制
                    </label>
                  </div>
                </div>

                {/* Restricted options */}
                {accessData.access_type === 'restricted' && (
                  <>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={accessData.allow_guests}
                          onChange={(e) => setAccessData({ ...accessData, allow_guests: e.target.checked })}
                          className="mr-2"
                        />
                        允许访客
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={accessData.allow_employees}
                          onChange={(e) => setAccessData({ ...accessData, allow_employees: e.target.checked })}
                          className="mr-2"
                        />
                        允许员工
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        允许的用户组
                      </label>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {userGroups.map((group) => (
                          <label key={group.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={accessData.allowed_user_groups.includes(group.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAccessData({
                                    ...accessData,
                                    allowed_user_groups: [...accessData.allowed_user_groups, group.id],
                                  });
                                } else {
                                  setAccessData({
                                    ...accessData,
                                    allowed_user_groups: accessData.allowed_user_groups.filter((id) => id !== group.id),
                                  });
                                }
                              }}
                              className="mr-2"
                            />
                            {group.name}
                          </label>
                        ))}
                        {userGroups.length === 0 && (
                          <p className="text-sm text-gray-500">暂无用户组</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Time Config */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    时间设置
                  </label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={accessData.time_type === 'permanent'}
                        onChange={() => setAccessData({ ...accessData, time_type: 'permanent' })}
                        className="mr-2"
                      />
                      永久
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={accessData.time_type === 'limited'}
                        onChange={() => setAccessData({ ...accessData, time_type: 'limited' })}
                        className="mr-2"
                      />
                      限时
                    </label>
                  </div>

                  {accessData.time_type === 'limited' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">开始时间</label>
                        <input
                          type="datetime-local"
                          value={accessData.start_date}
                          onChange={(e) => setAccessData({ ...accessData, start_date: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">结束时间</label>
                        <input
                          type="datetime-local"
                          value={accessData.end_date}
                          onChange={(e) => setAccessData({ ...accessData, end_date: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAccessEditor(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveAccess}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invitation Editor Modal */}
      <AnimatePresence>
        {showInvitationEditor && selectedSyllabus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowInvitationEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                邀请码管理: {selectedSyllabus.name}
              </h3>

              <InvitationCodeManager
                syllabusId={selectedSyllabus.id}
                allowGuests={selectedSyllabus.access_rules.allow_guests}
                onUpdate={loadData}
              />

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowInvitationEditor(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Syllabi List */}
      {syllabi.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <span className="text-4xl mb-4 block">📋</span>
          <p className="text-gray-500 dark:text-gray-400">暂无课程表</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            创建第一个课程表来组织培训课程
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {syllabi.map((syllabus) => (
            <motion.div
              key={syllabus.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      {syllabus.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        syllabus.is_published
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {syllabus.is_published ? '已发布' : '草稿'}
                    </span>
                  </div>
                  {syllabus.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {syllabus.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>{syllabus.course_sequence.length} 门课程</span>
                    <span>
                      {syllabus.access_type === 'public' ? '公开访问' : '限制访问'}
                    </span>
                    <span>
                      {syllabus.time_config.type === 'permanent' ? '永久有效' : '限时'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => openCourseEditor(syllabus)}
                  className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  管理课程
                </button>
                <button
                  onClick={() => openAccessEditor(syllabus)}
                  className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  访问设置
                </button>
                <button
                  onClick={() => openInvitationEditor(syllabus)}
                  className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  邀请码
                </button>
                <button
                  onClick={() => handleEdit(syllabus)}
                  className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => handlePublishToggle(syllabus)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    syllabus.is_published
                      ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                      : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}
                >
                  {syllabus.is_published ? '取消发布' : '发布'}
                </button>
                <button
                  onClick={() => handleDelete(syllabus.id)}
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

export default SyllabusManager;
