import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '../../stores/progressStore';
import { useWrongQuestionStore } from '../../stores/wrongQuestionStore';
import { CertificateList, CertificateView, CertificateBadgeInline } from '../Certificate';
import { getUserCertificates } from '../../services/certificateApi';
import { getUserBadges } from '../../services/badgeApi';
import type { Certificate, Badge } from '../../types';

const ACHIEVEMENTS = [
  // 课程完成类
  { id: 'first_course', title: '初学者', description: '完成第一个课程', icon: '🎓' },
  { id: 'course_3', title: '勤学者', description: '完成3个课程', icon: '📖' },
  { id: 'course_5', title: '学习达人', description: '完成5个课程', icon: '📚' },
  { id: 'course_all', title: '培训大师', description: '完成所有课程', icon: '🏅' },

  // 测验通过类
  { id: 'first_quiz', title: '首战告捷', description: '通过第一次测验', icon: '✅' },
  { id: 'perfect_quiz', title: '满分学霸', description: '测验满分通过', icon: '💯' },
  { id: 'quiz_5', title: '测验能手', description: '通过5次测验', icon: '🏆' },
  { id: 'quiz_streak_3', title: '三连胜', description: '连续3次测验通过', icon: '⭐' },

  // 学习连续类
  { id: 'streak_3', title: '初露锋芒', description: '连续学习3天', icon: '🔥' },
  { id: 'streak_7', title: '持之以恒', description: '连续学习7天', icon: '🔥' },
  { id: 'streak_30', title: '学习达人', description: '连续学习30天', icon: '💪' },

  // XP积分类
  { id: 'xp_100', title: '初级学员', description: '累计获得100 XP', icon: '💎' },
  { id: 'xp_500', title: '中级学员', description: '累计获得500 XP', icon: '💎' },
  { id: 'xp_1000', title: '高级学员', description: '累计获得1000 XP', icon: '👑' },
];

export function ProfileView() {
  const {
    username,
    streak,
    totalXP,
    hearts,
    maxHearts,
    achievements,
    dailyGoalMinutes,
    setDailyGoal,
    resetProgress,
    exchangeXPForHeart,
    // 培训系统字段
    coursesCompleted,
    quizzesPassed,
    quizStreak,
  } = useProgressStore();

  const { getUnresolvedCount, getTotalCount } = useWrongQuestionStore();

  // Certificate state
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificateView, setCertificateView] = useState<'none' | 'list' | 'detail'>('none');
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [loadingCertificates, setLoadingCertificates] = useState(true);

  // Badge state
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(true);

  // Fetch certificates
  useEffect(() => {
    const fetchCertificates = async () => {
      setLoadingCertificates(true);
      try {
        const data = await getUserCertificates();
        setCertificates(data);
      } catch (error) {
        console.error('Failed to fetch certificates:', error);
      } finally {
        setLoadingCertificates(false);
      }
    };

    fetchCertificates();
  }, []);

  // Fetch badges
  useEffect(() => {
    const fetchBadges = async () => {
      setLoadingBadges(true);
      try {
        const data = await getUserBadges();
        setBadges(data);
      } catch (error) {
        console.error('Failed to fetch badges:', error);
      } finally {
        setLoadingBadges(false);
      }
    };

    fetchBadges();
  }, []);

  const displayName = username || '学员';

  const canExchangeHeart = totalXP >= 100 && hearts < maxHearts;

  const handleExchangeHeart = () => {
    if (exchangeXPForHeart()) {
      // Success - heart restored
    }
  };

  const wrongCount = getTotalCount();
  const unresolvedCount = getUnresolvedCount();

  const handleResetProgress = () => {
    if (window.confirm('确定要重置所有学习进度吗？此操作不可撤销。')) {
      resetProgress();
    }
  };

  // Certificate handlers
  const handleOpenCertificateList = () => {
    setCertificateView('list');
  };

  const handleSelectCertificate = (cert: Certificate) => {
    setSelectedCertificate(cert);
    setCertificateView('detail');
  };

  const handleBackFromCertificateList = () => {
    setCertificateView('none');
  };

  const handleBackFromCertificateDetail = () => {
    setCertificateView('list');
    setSelectedCertificate(null);
  };

  // Render certificate views
  if (certificateView === 'list') {
    return (
      <CertificateList
        onSelectCertificate={handleSelectCertificate}
        onBack={handleBackFromCertificateList}
      />
    );
  }

  if (certificateView === 'detail' && selectedCertificate) {
    return (
      <CertificateView
        certificate={selectedCertificate}
        onBack={handleBackFromCertificateDetail}
      />
    );
  }

  return (
    <div className="pt-20 pb-24 px-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        {/* Profile header */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-[#58CC02] rounded-full flex items-center justify-center text-4xl">
              📚
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
              <p className="text-gray-500 dark:text-gray-400">Level {Math.floor(totalXP / 100) + 1}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <p className="text-2xl font-bold text-orange-500">🔥 {streak}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">连续学习</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <p className="text-2xl font-bold text-blue-500">💎 {totalXP}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">经验值</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <p className="text-2xl font-bold text-green-500">📚 {coursesCompleted.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">课程完成</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <p className="text-2xl font-bold text-purple-500">✅ {quizzesPassed}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">测验通过</p>
            </div>
          </div>
        </motion.div>

        {/* Progress stats */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📊 学习进度</h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500 dark:text-gray-400">测验连胜</span>
                <span className="font-medium">🔥 {quizStreak} 连胜</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#58CC02]"
                  style={{ width: `${Math.min(100, (quizStreak / 10) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">连续通过10次测验解锁特殊成就</p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500 dark:text-gray-400">错题本</span>
                <span className="font-medium">{unresolvedCount} / {wrongCount} 待掌握</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1CB0F6]"
                  style={{ width: wrongCount > 0 ? `${((wrongCount - unresolvedCount) / wrongCount) * 100}%` : '100%' }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {wrongCount > 0
                  ? `已掌握 ${wrongCount - unresolvedCount} 道错题`
                  : '暂无错题，继续保持！'
                }
              </p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500 dark:text-gray-400">红心</span>
                <span className="font-medium">{hearts} / {maxHearts}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {Array.from({ length: maxHearts }).map((_, i) => (
                    <span key={i} className="text-xl">
                      {i < hearts ? '❤️' : '🤍'}
                    </span>
                  ))}
                </div>
                {hearts < maxHearts && (
                  <motion.button
                    onClick={handleExchangeHeart}
                    disabled={!canExchangeHeart}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      canExchangeHeart
                        ? 'bg-[#1CB0F6] text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                    whileHover={canExchangeHeart ? { scale: 1.05 } : {}}
                    whileTap={canExchangeHeart ? { scale: 0.95 } : {}}
                  >
                    💎100 → ❤️
                  </motion.button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                ❤️ 每30分钟恢复1颗 · 测验答错扣1颗
              </p>
            </div>
          </div>
        </motion.div>

        {/* Badges section - 课程徽章 */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {'\ud83c\udfc5'} 课程徽章
          </h2>

          {loadingBadges ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-[#58CC02] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : badges.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                暂无徽章，通过课程测验后可获得
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {badges.map((badge) => (
                <motion.div
                  key={badge.badge_id}
                  className="p-3 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{'\ud83c\udfc5'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {badge.course_title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {badge.score}/{badge.max_score} ({badge.percentage}%)
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {badge.attempt_count > 1 ? `第 ${badge.attempt_count} 次通过` : '首次通过'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Certificates section */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {'\ud83c\udfc6'} 我的证书
            </h2>
            {certificates.length > 0 && (
              <button
                onClick={handleOpenCertificateList}
                className="text-sm text-[#58CC02] font-medium"
              >
                查看全部 {'\u2192'}
              </button>
            )}
          </div>

          {loadingCertificates ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-[#58CC02] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                暂无证书，完成培训后可获得
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Show up to 3 certificates as badges */}
              <div className="flex flex-wrap gap-2">
                {certificates.slice(0, 3).map((cert) => (
                  <CertificateBadgeInline
                    key={cert.certificate_id}
                    certificate={cert}
                    onClick={() => handleSelectCertificate(cert)}
                  />
                ))}
              </div>
              {certificates.length > 3 && (
                <button
                  onClick={handleOpenCertificateList}
                  className="w-full py-2 text-center text-sm text-gray-500 dark:text-gray-400 hover:text-[#58CC02]"
                >
                  还有 {certificates.length - 3} 个证书...
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Daily goal */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{'\ud83c\udfaf'} 每日目标</h2>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((minutes) => (
              <button
                key={minutes}
                onClick={() => setDailyGoal(minutes)}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  dailyGoalMinutes === minutes
                    ? 'bg-[#58CC02] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {minutes}分钟
              </button>
            ))}
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            🏆 成就 ({achievements.length}/{ACHIEVEMENTS.length})
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((achievement) => {
              const isUnlocked = achievements.includes(achievement.id);
              return (
                <motion.div
                  key={achievement.id}
                  className={`p-3 rounded-xl flex items-center gap-3 ${
                    isUnlocked
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                  whileHover={{ scale: 1.02 }}
                >
                  <span className={`text-2xl flex-shrink-0 ${!isUnlocked && 'grayscale opacity-30'}`}>
                    {achievement.icon}
                  </span>
                  <div className="min-w-0">
                    <p className={`font-medium text-sm truncate ${
                      isUnlocked
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {achievement.title}
                    </p>
                    <p className={`text-xs truncate ${
                      isUnlocked
                        ? 'text-gray-500 dark:text-gray-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}>
                      {achievement.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Reset button */}
        <motion.button
          onClick={handleResetProgress}
          className="w-full py-3 text-red-500 font-medium"
          whileTap={{ scale: 0.98 }}
        >
          重置学习进度
        </motion.button>
      </div>
    </div>
  );
}
