import { motion } from 'framer-motion';
import { useProgressStore } from '../../stores/progressStore';
import { useCourseStore } from '../../stores/courseStore';

interface HeaderProps {
  onLogout?: () => void;
}

export function Header({ onLogout }: HeaderProps) {
  const { streak, totalXP, hearts, maxHearts, darkMode, toggleDarkMode } = useProgressStore();
  const { surveyUserInfo } = useCourseStore();

  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-50 transition-colors">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Streak */}
        <motion.div
          className="flex items-center gap-1"
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-xl">🔥</span>
          <span className="font-bold text-orange-500">{streak}</span>
        </motion.div>

        {/* XP */}
        <motion.div
          className="flex items-center gap-1"
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-xl">💎</span>
          <span className="font-bold text-blue-500">{totalXP}</span>
        </motion.div>

        {/* Hearts */}
        <motion.div
          className="flex items-center gap-1"
          whileHover={{ scale: 1.05 }}
        >
          <div className="flex">
            {Array.from({ length: maxHearts }).map((_, i) => (
              <span key={i} className="text-lg">
                {i < hearts ? '❤️' : '🤍'}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Admin Entry */}
        <motion.button
          onClick={() => window.location.href = '/admin'}
          className="text-2xl"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="管理后台"
        >
          ⚙️
        </motion.button>

        {/* Dark Mode Toggle */}
        <motion.button
          onClick={toggleDarkMode}
          className="text-2xl"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {darkMode ? '☀️' : '🌙'}
        </motion.button>

        {/* Logout Button */}
        {onLogout && (
          <motion.button
            onClick={onLogout}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={surveyUserInfo?.name ? `退出 (${surveyUserInfo.name})` : '退出登录'}
          >
            <span>🚪</span>
            <span className="hidden sm:inline">退出</span>
          </motion.button>
        )}
      </div>
    </header>
  );
}
