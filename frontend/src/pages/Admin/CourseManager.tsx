import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import adminApi from '../../services/adminApi';
import type { Course, CourseIconType } from '../../types';
import { IconSelector, getCourseIcon, defaultCourseIcon } from '../../components/Syllabus/CourseIcons';

export function CourseManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [error, setError] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  // Get all unique tags from courses
  const allTags = Array.from(
    new Set(courses.flatMap((course) => course.tags || []))
  ).sort();

  // Filter courses by selected tag
  const filteredCourses = selectedTag
    ? courses.filter((course) => course.tags?.includes(selectedTag))
    : courses;

  // Load courses on mount
  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getCourses();
      setCourses(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch (err) {
      setError('加载课程失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!confirm('确定要删除这个课程吗？此操作不可恢复。')) {
      return;
    }

    try {
      await adminApi.deleteCourse(courseId);
      setCourses(courses.filter((c) => c.id !== courseId));
    } catch (err) {
      setError('删除失败');
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingCourse(null);
    loadCourses();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          课程列表
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          添加课程
        </button>
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">筛选标签:</span>
          <button
            onClick={() => setSelectedTag('')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedTag === ''
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedTag === tag
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg"
        >
          {error}
        </motion.div>
      )}

      {/* Course List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {filteredCourses.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {selectedTag ? `没有标签为"${selectedTag}"的课程` : '暂无课程，点击"添加课程"创建第一个课程'}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  顺序
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  图标
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  课程名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  标签
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  页数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  考卷
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCourses.map((course) => (
                <motion.tr
                  key={course.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {course.order}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                      {getCourseIcon(course.icon)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {course.title}
                      </div>
                    </div>
                    {course.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {course.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      {course.type === 'pdf' ? 'PDF' : course.type === 'ppt' ? 'PPT' : '文本'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {course.tags && course.tags.length > 0 ? (
                        course.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {course.totalPages || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {course.quiz ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        已关联 ({course.quiz.pass_score}分及格)
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">
                        未关联
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(course)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(course.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      删除
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <CourseModal
            course={editingCourse}
            allTags={allTags}
            onClose={handleModalClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Course Modal Component
interface CourseModalProps {
  course: Course | null;
  allTags: string[];
  onClose: () => void;
}

function CourseModal({ course, allTags, onClose }: CourseModalProps) {
  const [title, setTitle] = useState(course?.title || '');
  const [description, setDescription] = useState(course?.description || '');
  const [icon, setIcon] = useState<CourseIconType>(course?.icon || defaultCourseIcon);
  const [quizSurveyId, setQuizSurveyId] = useState(course?.quiz?.survey_id || '');
  const [passScore, setPassScore] = useState(course?.quiz?.pass_score || 60);
  const [tags, setTags] = useState<string[]>(course?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Survey list for dropdown
  const [surveys, setSurveys] = useState<{ survey_id: string; title: string; total_questions: number; pass_score: number }[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);

  const isEditing = !!course;

  // Handle adding a tag
  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  // Handle removing a tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle tag input keydown (Enter to add)
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Load surveys when modal opens
  useEffect(() => {
    const loadSurveys = async () => {
      setLoadingSurveys(true);
      try {
        const data = await adminApi.getSurveys();
        setSurveys(data);
      } catch (error) {
        console.error('Failed to load surveys:', error);
      } finally {
        setLoadingSurveys(false);
      }
    };
    loadSurveys();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('请输入课程名称');
      return;
    }

    if (!isEditing && !pdfFile) {
      setError('请上传 PDF 文件');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        // Update existing course
        await adminApi.updateCourse(course.id, {
          title,
          description,
          icon,
          tags,
          quiz: quizSurveyId ? { survey_id: quizSurveyId, pass_score: passScore } : undefined,
        });
      } else {
        // Create new course
        await adminApi.createCourse(
          title,
          description,
          pdfFile!,
          quizSurveyId || undefined,
          passScore,
          tags,
          icon
        );
      }
      onClose();
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('请上传 PDF 文件');
        return;
      }
      setPdfFile(file);
      setError('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
      >
        <div className="p-6 pb-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {isEditing ? '编辑课程' : '添加课程'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              课程名称 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：Python 基础教程"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              课程描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简单介绍课程内容..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              课程图标
            </label>
            <IconSelector value={icon} onChange={setIcon} />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              标签
            </label>
            {/* 已选标签 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-indigo-900 dark:hover:text-indigo-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* 可选标签（已有标签中未被选择的） */}
            {allTags.filter(t => !tags.includes(t)).length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">点击添加已有标签:</p>
                <div className="flex flex-wrap gap-2">
                  {allTags.filter(t => !tags.includes(t)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags([...tags, tag])}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* 新建标签输入 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="输入新标签后按回车添加"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                新建
              </button>
            </div>
          </div>

          {/* PDF Upload (only for new courses) */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                上传 PDF *
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors"
              >
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <span>📄</span>
                    <span>{pdfFile.name}</span>
                  </div>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">
                    <span className="text-3xl block mb-2">📤</span>
                    点击上传 PDF 文件
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Quiz Link */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              关联考卷 (可选)
            </label>
            <select
              value={quizSurveyId}
              onChange={(e) => {
                setQuizSurveyId(e.target.value);
                // Auto-fill the pass score from the selected survey
                const selected = surveys.find(s => s.survey_id === e.target.value);
                if (selected) {
                  setPassScore(selected.pass_score || 60);
                }
              }}
              disabled={loadingSurveys}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
            >
              <option value="">不关联考卷</option>
              {surveys.map(survey => (
                <option key={survey.survey_id} value={survey.survey_id}>
                  {survey.title} ({survey.total_questions}题, {survey.pass_score}分及格)
                </option>
              ))}
            </select>
            {loadingSurveys && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                加载考卷列表中...
              </p>
            )}
          </div>

          {/* Pass Score */}
          {quizSurveyId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                及格分数
              </label>
              <input
                type="number"
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          </div>

          {/* Actions - Fixed at bottom */}
          <div className="flex justify-end gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? '处理中...' : isEditing ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default CourseManager;
