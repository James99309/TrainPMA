import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GuestInvitation } from '../../types';
import { adminApi } from '../../services/adminApi';

interface InvitationCodeManagerProps {
  syllabusId: string;
  allowGuests: boolean;
  onUpdate?: () => void;
}

export function InvitationCodeManager({
  syllabusId,
  allowGuests,
  onUpdate,
}: InvitationCodeManagerProps) {
  const [invitation, setInvitation] = useState<GuestInvitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state for generating new code
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customCode: '',
    expiresAt: '',
    maxUses: '',
  });
  const [generating, setGenerating] = useState(false);

  // Load invitation code info
  useEffect(() => {
    loadInvitationCode();
  }, [syllabusId]);

  const loadInvitationCode = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getInvitationCode(syllabusId);
      setInvitation(result);
    } catch (err: any) {
      setError(err.message || '加载邀请码信息失败');
    } finally {
      setLoading(false);
    }
  };

  // Generate new invitation code
  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const options: {
        custom_code?: string;
        expires_at?: string;
        max_uses?: number;
      } = {};

      if (formData.customCode.trim()) {
        options.custom_code = formData.customCode.trim().toUpperCase();
      }
      if (formData.expiresAt) {
        options.expires_at = new Date(formData.expiresAt).toISOString();
      }
      if (formData.maxUses && parseInt(formData.maxUses) > 0) {
        options.max_uses = parseInt(formData.maxUses);
      }

      const result = await adminApi.generateInvitationCode(syllabusId, options);
      setInvitation(result);
      setSuccess('邀请码已生成');
      setShowForm(false);
      setFormData({ customCode: '', expiresAt: '', maxUses: '' });
      onUpdate?.();
    } catch (err: any) {
      setError(err.message || '生成邀请码失败');
    } finally {
      setGenerating(false);
    }
  };

  // Delete invitation code
  const handleDelete = async () => {
    if (!confirm('确定要删除邀请码吗？删除后使用此邀请码的客人将无法访问课程表。')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await adminApi.deleteInvitationCode(syllabusId);
      setInvitation(null);
      setSuccess('邀请码已删除');
      onUpdate?.();
    } catch (err: any) {
      setError(err.message || '删除邀请码失败');
    } finally {
      setLoading(false);
    }
  };

  // Copy code to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('邀请码已复制到剪贴板');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('复制失败，请手动复制');
    }
  };

  // Format date for display
  const formatDate = (isoString: string | null) => {
    if (!isoString) return '无限制';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!allowGuests) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-700 text-sm">
          需要先在访问规则中启用"允许客人访问"才能使用邀请码功能
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">邀请码管理</h3>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"
          >
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="ml-2 text-gray-500">加载中...</span>
        </div>
      ) : invitation ? (
        /* Display Current Invitation Code */
        <div className="space-y-4">
          {/* Code Display */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">当前邀请码</p>
              <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">
                {invitation.code}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(invitation.code)}
              className="px-4 py-2 bg-[#58CC02] text-white rounded-lg hover:bg-[#46a302] transition-colors"
            >
              复制
            </button>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            {invitation.is_expired && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                已过期
              </span>
            )}
            {invitation.is_exhausted && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                使用次数已达上限
              </span>
            )}
            {!invitation.is_expired && !invitation.is_exhausted && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                有效
              </span>
            )}
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">创建时间</p>
              <p className="text-gray-900">{formatDate(invitation.created_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">过期时间</p>
              <p className="text-gray-900">{formatDate(invitation.expires_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">使用次数</p>
              <p className="text-gray-900">
                {invitation.current_uses}
                {invitation.max_uses !== null && ` / ${invitation.max_uses}`}
              </p>
            </div>
            <div>
              <p className="text-gray-500">使用限制</p>
              <p className="text-gray-900">
                {invitation.max_uses === null ? '无限制' : `最多 ${invitation.max_uses} 次`}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowForm(true)}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              重新生成
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      ) : (
        /* No Invitation Code */
        <div className="text-center py-6">
          <p className="text-gray-500 mb-4">尚未生成邀请码</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2 bg-[#58CC02] text-white rounded-lg hover:bg-[#46a302] transition-colors"
          >
            生成邀请码
          </button>
        </div>
      )}

      {/* Generate Form Modal */}
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {invitation ? '重新生成邀请码' : '生成邀请码'}
              </h3>

              <div className="space-y-4">
                {/* Custom Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    自定义邀请码（可选）
                  </label>
                  <input
                    type="text"
                    value={formData.customCode}
                    onChange={(e) =>
                      setFormData({ ...formData, customCode: e.target.value.toUpperCase() })
                    }
                    placeholder="留空则自动生成"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-[#58CC02] focus:outline-none"
                    maxLength={16}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    仅支持大写字母和数字，最多 16 个字符
                  </p>
                </div>

                {/* Expires At */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    有效期（可选）
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-[#58CC02] focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">留空表示永久有效</p>
                </div>

                {/* Max Uses */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大使用次数（可选）
                  </label>
                  <input
                    type="number"
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                    placeholder="留空表示无限制"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-[#58CC02] focus:outline-none"
                    min="1"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={generating}
                >
                  取消
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 px-4 py-2 bg-[#58CC02] text-white rounded-lg hover:bg-[#46a302] transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      生成中...
                    </span>
                  ) : (
                    '生成'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
