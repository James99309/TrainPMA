import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '../../stores/progressStore';

interface ChapterCompleteProps {
  chapterId: number;
  xpEarned: number;
  wordsLearned: number;
  onContinue: () => void;
}

export function ChapterComplete({
  chapterId,
  xpEarned,
  wordsLearned,
  onContinue,
}: ChapterCompleteProps) {
  const { streak, completeChapter, updateStreak, addXP } = useProgressStore();

  useEffect(() => {
    completeChapter(chapterId);
    updateStreak();
    addXP(50);
  }, [chapterId, completeChapter, updateStreak, addXP]);

  return (
    <motion.div
      className="fixed inset-0 bg-[#58CC02] z-50 flex flex-col items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Confetti animation */}
      <motion.div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{
              backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'][i % 4],
              left: `${Math.random() * 100}%`,
              top: '-20px',
            }}
            animate={{
              y: ['0vh', '100vh'],
              rotate: [0, 360],
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

      {/* Trophy */}
      <motion.div
        className="text-8xl mb-6"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 10, stiffness: 100, delay: 0.2 }}
      >
        🏆
      </motion.div>

      {/* Title */}
      <motion.h1
        className="text-3xl font-bold text-white mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        Chapter Complete!
      </motion.h1>

      <motion.p
        className="text-white/80 text-lg mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Amazing work! Keep it up!
      </motion.p>

      {/* Stats */}
      <motion.div
        className="bg-white/20 rounded-2xl p-6 w-full max-w-sm mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex justify-around text-center">
          <div>
            <p className="text-4xl font-bold text-white">+{xpEarned + 50}</p>
            <p className="text-white/70 text-sm">XP Earned</p>
          </div>
          <div className="border-l border-white/30" />
          <div>
            <p className="text-4xl font-bold text-white">{wordsLearned}</p>
            <p className="text-white/70 text-sm">Words</p>
          </div>
          <div className="border-l border-white/30" />
          <div>
            <p className="text-4xl font-bold text-white">🔥 {streak}</p>
            <p className="text-white/70 text-sm">Streak</p>
          </div>
        </div>
      </motion.div>

      {/* Continue button */}
      <motion.button
        onClick={onContinue}
        className="bg-white text-[#58CC02] font-bold py-4 px-12 rounded-xl text-lg shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Continue
      </motion.button>
    </motion.div>
  );
}
