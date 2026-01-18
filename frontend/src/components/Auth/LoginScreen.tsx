import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserInfo, InvitationCodeValidation } from '../../types';
import authApi from '../../services/authApi';

type LoginMode = 'guest' | 'employee';

interface LoginScreenProps {
  onLogin: (userInfo: UserInfo) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  // Login mode state
  const [loginMode, setLoginMode] = useState<LoginMode>('guest');

  // Guest login form state
  const [guestForm, setGuestForm] = useState({
    name: '',
    company: '',
    phone: '',
  });

  // Employee login form state
  const [employeeForm, setEmployeeForm] = useState({
    username: '',
    password: '',
  });

  // Invitation code state
  const [invitationCode, setInvitationCode] = useState('');
  const [invitationCodeValid, setInvitationCodeValid] = useState<InvitationCodeValidation | null>(null);
  const [invitationCodeError, setInvitationCodeError] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);

  // Common state
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Check for saved login on mount
  useEffect(() => {
    const savedUser = authApi.getSavedAuthData();
    if (savedUser) {
      onLogin(savedUser);
    }
  }, [onLogin]);

  // Validate invitation code on blur
  const validateInvitationCode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setInvitationCodeValid(null);
      setInvitationCodeError('');
      return;
    }

    setValidatingCode(true);
    setInvitationCodeError('');

    const result = await authApi.validateInvitationCode(code.trim());

    setValidatingCode(false);

    if (result.success && result.data) {
      setInvitationCodeValid(result.data);
      setInvitationCodeError('');
    } else {
      setInvitationCodeValid(null);
      setInvitationCodeError(result.message || '邀请码无效');
    }
  }, []);

  // Handle invitation code blur
  const handleInvitationCodeBlur = () => {
    if (invitationCode.trim()) {
      validateInvitationCode(invitationCode);
    }
  };

  // Handle guest login
  const handleGuestLogin = async () => {
    const { name, company, phone } = guestForm;

    if (!name.trim()) {
      setError('请输入姓名');
      return;
    }
    if (!company.trim()) {
      setError('请输入公司名称');
      return;
    }
    if (!phone.trim()) {
      setError('请输入手机号码');
      return;
    }

    // Check if invitation code is provided but invalid
    if (invitationCode.trim() && !invitationCodeValid) {
      setError('请输入有效的邀请码');
      return;
    }

    setLoading(true);
    setError('');

    const result = await authApi.guestLogin(
      name.trim(),
      company.trim(),
      phone.trim(),
      rememberMe,
      invitationCode.trim() || undefined
    );

    setLoading(false);

    if (result.success && result.data) {
      onLogin(result.data);
    } else {
      setError(result.message || '登录失败');
    }
  };

  // Handle employee login
  const handleEmployeeLogin = async () => {
    const { username, password } = employeeForm;

    if (!username.trim()) {
      setError('请输入账户');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');

    const result = await authApi.employeeLogin(
      username.trim(),
      password,
      rememberMe
    );

    setLoading(false);

    if (result.success && result.data) {
      onLogin(result.data);
    } else {
      setError(result.message || '账户或密码错误');
    }
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMode === 'guest') {
      handleGuestLogin();
    } else {
      handleEmployeeLogin();
    }
  };

  // Switch login mode
  const switchMode = (mode: LoginMode) => {
    setLoginMode(mode);
    setError('');
  };

  // Check if form is valid
  const isFormValid = () => {
    if (loginMode === 'guest') {
      return guestForm.name.trim() && guestForm.company.trim() && guestForm.phone.trim();
    }
    return employeeForm.username.trim() && employeeForm.password;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#58CC02] to-[#46a302] flex items-center justify-center p-4">
      <motion.div
        className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl mb-2">🎓</h1>
          <h2 className="text-2xl font-bold text-gray-900">培训系统</h2>
          <p className="text-gray-500 mt-2">请登录以开始学习</p>
        </div>

        {/* Login Mode Tabs */}
        <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
          <button
            type="button"
            onClick={() => switchMode('guest')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              loginMode === 'guest'
                ? 'bg-white text-[#58CC02] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">👤</span>
            客人
          </button>
          <button
            type="button"
            onClick={() => switchMode('employee')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              loginMode === 'employee'
                ? 'bg-white text-[#58CC02] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">👔</span>
            员工
          </button>
        </div>

        {/* Error Message */}
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
        </AnimatePresence>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {loginMode === 'guest' ? (
              /* Guest Login Form */
              <motion.div
                key="guest"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      姓名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={guestForm.name}
                      onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                      placeholder="请输入您的姓名"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#58CC02] focus:outline-none text-lg"
                      autoFocus
                    />
                  </div>

                  {/* Company */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      公司 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={guestForm.company}
                      onChange={(e) => setGuestForm({ ...guestForm, company: e.target.value })}
                      placeholder="请输入您的公司名称"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#58CC02] focus:outline-none text-lg"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      电话 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={guestForm.phone}
                      onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                      placeholder="请输入您的手机号码"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#58CC02] focus:outline-none text-lg"
                    />
                  </div>

                  {/* Invitation Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      邀请码
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={invitationCode}
                        onChange={(e) => {
                          setInvitationCode(e.target.value.toUpperCase());
                          setInvitationCodeError('');
                          setInvitationCodeValid(null);
                        }}
                        onBlur={handleInvitationCodeBlur}
                        placeholder="请输入邀请码"
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-colors text-lg ${
                          invitationCodeError
                            ? 'border-red-300 focus:border-red-500'
                            : invitationCodeValid
                            ? 'border-green-300 focus:border-green-500'
                            : 'border-gray-200 focus:border-[#58CC02]'
                        } focus:outline-none`}
                      />
                      {validatingCode && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
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
                        </div>
                      )}
                      {!validatingCode && invitationCodeValid && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500">
                          ✓
                        </div>
                      )}
                      {!validatingCode && invitationCodeError && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500">
                          ✗
                        </div>
                      )}
                    </div>

                    {/* Validation Result */}
                    <AnimatePresence>
                      {invitationCodeValid && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg"
                        >
                          <p className="text-sm text-green-700">
                            <span className="font-medium">✓ 邀请码有效</span>
                          </p>
                          <p className="text-sm text-green-600 mt-1">
                            课程表：{invitationCodeValid.syllabus_name}
                          </p>
                        </motion.div>
                      )}
                      {invitationCodeError && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                        >
                          <p className="text-sm text-red-600">
                            {invitationCodeError}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Employee Login Form */
              <motion.div
                key="employee"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="space-y-4">
                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      账户 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={employeeForm.username}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, username: e.target.value })}
                      placeholder="请输入员工账户"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#58CC02] focus:outline-none text-lg"
                      autoFocus
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      密码 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={employeeForm.password}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                        placeholder="请输入密码"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#58CC02] focus:outline-none text-lg pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Employee hint */}
                <p className="mt-4 text-sm text-gray-500 text-center">
                  💡 员工请使用公司统一账号登录
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Remember Me Checkbox */}
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#58CC02] focus:ring-[#58CC02]"
              />
              记住登录状态（30天内免登录）
            </label>
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={!isFormValid() || loading}
            className={`w-full mt-6 py-4 rounded-xl font-bold text-lg transition-colors ${
              isFormValid() && !loading
                ? 'bg-[#58CC02] text-white hover:bg-[#46a302]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            whileHover={isFormValid() && !loading ? { scale: 1.02 } : {}}
            whileTap={isFormValid() && !loading ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                登录中...
              </span>
            ) : loginMode === 'guest' ? (
              '开始学习'
            ) : (
              '员工登录'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
