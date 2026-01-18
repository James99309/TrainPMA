import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '../../stores/progressStore';
import { surveyApi } from '../../services/surveyApi';
import type { LeaderboardEntry } from '../../types';

interface SurveyResultProps {
  surveyId: string;
  passed: boolean;
  score: number;
  maxScore: number;
  percentage: number;
  passScore?: number;
  onContinue: () => void;
  onRetry?: () => void;
}

export function SurveyResult({
  surveyId,
  passed,
  score,
  maxScore,
  percentage,
  passScore = 60,
  onContinue,
  onRetry,
}: SurveyResultProps) {
  const { streak } = useProgressStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const bgColor = passed ? '#58CC02' : '#FF4B4B';

  // Load leaderboard
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const data = await surveyApi.getLeaderboard(surveyId);
        setLeaderboard(data.slice(0, 10));
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLoadingLeaderboard(false);
      }
    };
    loadLeaderboard();
  }, [surveyId]);

  // Confetti colors
  const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FF9600', '#1CB0F6'];

  if (showLeaderboard) {
    return (
      <motion.div
        className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm p-4">
          <div className="max-w-lg mx-auto flex items-center">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <span className="text-2xl">←</span>
            </button>
            <h1 className="ml-2 text-xl font-bold text-gray-900 dark:text-white">🏆 排行榜</h1>
          </div>
        </div>

        {/* Leaderboard list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-lg mx-auto space-y-3">
            {loadingLeaderboard ? (
              <div className="text-center py-8">
                <motion.div
                  className="w-12 h-12 border-4 border-[#58CC02] border-t-transparent rounded-full mx-auto"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                暂无排行数据
              </div>
            ) : (
              leaderboard.map((entry, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-4 p-4 rounded-xl ${
                    index < 3
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'
                      : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      index === 0
                        ? 'bg-yellow-400 text-yellow-900'
                        : index === 1
                        ? 'bg-gray-300 text-gray-700'
                        : index === 2
                        ? 'bg-orange-400 text-orange-900'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white">{entry.username}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Level {entry.level}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#58CC02]">{entry.totalXP}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">XP</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Back button */}
        <div className="p-4 bg-white dark:bg-gray-800 shadow-lg">
          <div className="max-w-lg mx-auto">
            <motion.button
              onClick={() => setShowLeaderboard(false)}
              className="w-full bg-[#58CC02] text-white font-bold py-4 rounded-xl text-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              返回
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: bgColor }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Confetti animation (only for passed) */}
      {passed && (
        <motion.div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3"
              style={{
                backgroundColor: confettiColors[i % confettiColors.length],
                borderRadius: i % 2 === 0 ? '50%' : '0',
                left: `${Math.random() * 100}%`,
                top: '-20px',
              }}
              animate={{
                y: ['0vh', '100vh'],
                rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
                opacity: [1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: 'easeIn',
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Trophy / Sad emoji */}
      <motion.div
        className="text-8xl mb-6"
        initial={{ scale: 0, rotate: passed ? -180 : 0 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 10, stiffness: 100, delay: 0.2 }}
      >
        {passed ? '🏆' : '😔'}
      </motion.div>

      {/* Title */}
      <motion.h1
        className="text-3xl font-bold text-white mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {passed ? '测验通过！' : '未能通过'}
      </motion.h1>

      <motion.p
        className="text-white/80 text-lg mb-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {passed ? '恭喜你完成了测验！' : `需要达到 ${passScore} 分才能通过`}
      </motion.p>

      {/* Score card */}
      <motion.div
        className="bg-white/20 rounded-2xl p-6 w-full max-w-sm mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {/* Score circle */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="12"
                fill="none"
              />
              <motion.circle
                cx="64"
                cy="64"
                r="56"
                stroke="white"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: '0 352' }}
                animate={{ strokeDasharray: `${(percentage / 100) * 352} 352` }}
                transition={{ duration: 1, delay: 0.8 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{Math.round(percentage)}%</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-around text-center">
          <div>
            <p className="text-2xl font-bold text-white">
              {score}/{maxScore}
            </p>
            <p className="text-white/70 text-sm">得分</p>
          </div>
          <div className="border-l border-white/30" />
          <div>
            <p className="text-2xl font-bold text-white">{passed ? '+30' : '+0'}</p>
            <p className="text-white/70 text-sm">XP</p>
          </div>
          <div className="border-l border-white/30" />
          <div>
            <p className="text-2xl font-bold text-white">🔥 {streak}</p>
            <p className="text-white/70 text-sm">连续</p>
          </div>
        </div>
      </motion.div>

      {/* Buttons */}
      <motion.div
        className="w-full max-w-sm space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        {passed ? (
          <>
            <motion.button
              onClick={onContinue}
              className="w-full bg-white text-[#58CC02] font-bold py-4 rounded-xl text-lg shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              继续
            </motion.button>
            <motion.button
              onClick={() => setShowLeaderboard(true)}
              className="w-full bg-white/20 text-white font-bold py-4 rounded-xl text-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              🏆 查看排行榜
            </motion.button>
          </>
        ) : (
          <>
            {onRetry && (
              <motion.button
                onClick={onRetry}
                className="w-full bg-white text-[#FF4B4B] font-bold py-4 rounded-xl text-lg shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🔄 重新测验
              </motion.button>
            )}
            <motion.button
              onClick={onContinue}
              className="w-full bg-white/20 text-white font-bold py-4 rounded-xl text-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              返回
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
