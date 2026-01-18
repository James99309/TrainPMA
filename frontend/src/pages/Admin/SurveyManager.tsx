import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import adminApi from '../../services/adminApi';
import type { Survey } from '../../types';

export function SurveyManager() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    study_content_html: '',
    start_time: '',
    end_time: '',
    duration_minutes: 30,
    total_questions: 0,
    pass_score: 60,
    max_attempts: 3,
  });

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getSurveys();
      setSurveys(data);
    } catch (err) {
      console.error('Failed to load surveys:', err);
      setError('加载考卷失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSurvey(null);
    setFormData({
      title: '',
      description: '',
      study_content_html: '',
      start_time: new Date().toISOString().slice(0, 16),
      end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      duration_minutes: 30,
      total_questions: 0,
      pass_score: 60,
      max_attempts: 3,
    });
    setShowModal(true);
    setError('');
  };

  const handleEdit = (survey: Survey) => {
    setEditingSurvey(survey);
    setFormData({
      title: survey.title,
      description: survey.description,
      study_content_html: survey.study_content_html,
      start_time: survey.start_time.slice(0, 16),
      end_time: survey.end_time.slice(0, 16),
      duration_minutes: survey.duration_minutes,
      total_questions: survey.total_questions,
      pass_score: survey.pass_score,
      max_attempts: survey.max_attempts,
    });
    setShowModal(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingSurvey) {
        await adminApi.updateSurvey(editingSurvey.survey_id, formData);
      } else {
        await adminApi.createSurvey(formData);
      }
      setShowModal(false);
      loadSurveys();
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (surveyId: string, surveyTitle: string) => {
    if (!surveyId) {
      alert('无法删除：考卷 ID 为空');
      return;
    }

    if (!confirm(`确定要删除考卷"${surveyTitle || '(无标题)'}"吗？\n\nID: ${surveyId}\n\n删除后将同时删除所有相关题目，且无法恢复。`)) return;

    try {
      setError(''); // Clear previous errors
      await adminApi.deleteSurvey(surveyId);
      // Remove from local state immediately for better UX
      setSurveys(surveys.filter(s => s.survey_id !== surveyId));
    } catch (err: any) {
      console.error('Delete survey error:', err);
      const errorMessage = err.message || '删除失败';
      setError(`删除失败: ${errorMessage}`);
      alert(`删除失败: ${errorMessage}`);
    }
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
          考卷管理
        </h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          创建考卷
        </button>
      </div>

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

      {/* Survey List */}
      {surveys.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center text-gray-500 dark:text-gray-400">
          暂无考卷，点击上方按钮创建
        </div>
      ) : (
        <div className="grid gap-4">
          {surveys.map((survey) => (
            <motion.div
              key={survey.survey_id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {survey.title}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    {survey.description || '暂无描述'}
                  </p>

                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1">
                      <span>⏱️</span> {survey.duration_minutes}分钟
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📝</span> {survey.total_questions}题
                    </span>
                    <span className="flex items-center gap-1">
                      <span>🎯</span> 及格{survey.pass_score}分
                    </span>
                    <span className="flex items-center gap-1">
                      <span>🔄</span> 最多{survey.max_attempts}次
                    </span>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        survey.is_active === 'TRUE'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {survey.is_active === 'TRUE' ? '进行中' : '未激活'}
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {survey.start_time.slice(0, 10)} ~ {survey.end_time.slice(0, 10)}
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      ID: {survey.survey_id.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(survey)}
                    className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <span>✏️</span>
                  </button>
                  <button
                    onClick={() => handleDelete(survey.survey_id, survey.title)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="删除"
                  >
                    <span>🗑️</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingSurvey ? '编辑考卷' : '创建考卷'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    标题 *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    学习内容 (HTML)
                  </label>
                  <textarea
                    value={formData.study_content_html}
                    onChange={(e) => setFormData({ ...formData, study_content_html: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
                    placeholder="<p>学习内容...</p>"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      开始时间
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      结束时间
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      答题时长 (分钟)
                    </label>
                    <input
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
                      min={1}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      题目数量
                    </label>
                    <input
                      type="number"
                      value={formData.total_questions}
                      onChange={(e) => setFormData({ ...formData, total_questions: parseInt(e.target.value) || 0 })}
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      及格分数
                    </label>
                    <input
                      type="number"
                      value={formData.pass_score}
                      onChange={(e) => setFormData({ ...formData, pass_score: parseInt(e.target.value) || 60 })}
                      min={0}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      最大尝试次数
                    </label>
                    <input
                      type="number"
                      value={formData.max_attempts}
                      onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 3 })}
                      min={1}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SurveyManager;
