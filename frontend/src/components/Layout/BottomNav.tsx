import { motion } from 'framer-motion';
import { useWrongQuestionStore } from '../../stores/wrongQuestionStore';

export type TabType = 'syllabus' | 'course' | 'read' | 'wrong' | 'leaderboard' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  mode?: 'course' | 'read';
}

const courseTabs = [
  { id: 'syllabus' as const, icon: '📋', label: '培训' },
  { id: 'wrong' as const, icon: '📝', label: '复习' },
  { id: 'leaderboard' as const, icon: '🏆', label: '排行' },
  { id: 'profile' as const, icon: '👤', label: '我的' },
];

const readTabs = [
  { id: 'read' as const, icon: '📖', label: 'Read' },
  { id: 'wrong' as const, icon: '📝', label: 'Review' },
  { id: 'leaderboard' as const, icon: '🏆', label: 'Rank' },
  { id: 'profile' as const, icon: '👤', label: 'Profile' },
];

export function BottomNav({ activeTab, onTabChange, mode = 'course' }: BottomNavProps) {
  const tabs = mode === 'course' ? courseTabs : readTabs;
  const unresolvedCount = useWrongQuestionStore((state) => state.getUnresolvedCount());

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-around">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
              activeTab === tab.id
                ? 'text-[#58CC02]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-2xl relative">
              {tab.icon}
              {tab.id === 'wrong' && unresolvedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold">
                  {unresolvedCount > 99 ? '99+' : unresolvedCount}
                </span>
              )}
            </span>
            <span className="text-xs font-medium">{tab.label}</span>
          </motion.button>
        ))}
      </div>
    </nav>
  );
}
