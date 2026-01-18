import { motion } from 'framer-motion';
import { useProgressStore } from '../../stores/progressStore';

interface Chapter {
  id: number;
  title: string;
  content: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}

interface ChapterListProps {
  chapters: Chapter[];
  onSelectChapter: (chapter: Chapter) => void;
}

export function ChapterList({ chapters, onSelectChapter }: ChapterListProps) {
  const { chaptersCompleted, currentChapter } = useProgressStore();

  const getChapterStatus = (chapterId: number) => {
    if (chaptersCompleted.includes(chapterId)) return 'completed';
    if (chapterId === currentChapter) return 'current';
    if (chapterId <= currentChapter || chaptersCompleted.includes(chapterId - 1)) return 'unlocked';
    return 'locked';
  };

  const getStars = (chapterId: number) => {
    if (!chaptersCompleted.includes(chapterId)) return 0;
    return 3;
  };

  return (
    <div className="py-8">
      {/* Book title */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📖 STARGIRL</h1>
        <p className="text-gray-500 dark:text-gray-400">by Jerry Spinelli</p>
      </motion.div>

      {/* Chapter tree */}
      <div className="flex flex-col items-center gap-4">
        {chapters.map((chapter, index) => {
          const status = getChapterStatus(chapter.id);
          const stars = getStars(chapter.id);
          const isLocked = status === 'locked';

          return (
            <motion.div
              key={chapter.id}
              className="relative"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Connector line */}
              {index > 0 && (
                <div className="absolute left-1/2 -top-4 w-0.5 h-4 bg-gray-300 -translate-x-1/2" />
              )}

              {/* Chapter button */}
              <motion.button
                onClick={() => !isLocked && onSelectChapter(chapter)}
                disabled={isLocked}
                className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center font-bold text-lg shadow-lg transition-all ${
                  status === 'completed'
                    ? 'bg-[#58CC02] text-white'
                    : status === 'current'
                    ? 'bg-[#1CB0F6] text-white ring-4 ring-blue-200'
                    : status === 'unlocked'
                    ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                whileHover={!isLocked ? { scale: 1.1 } : {}}
                whileTap={!isLocked ? { scale: 0.95 } : {}}
              >
                {isLocked ? (
                  <span className="text-2xl">🔒</span>
                ) : (
                  <>
                    <span>Ch{chapter.id}</span>
                    {status === 'completed' && (
                      <div className="flex gap-0.5 mt-1">
                        {[1, 2, 3].map((s) => (
                          <span key={s} className="text-xs">
                            {s <= stars ? '⭐' : '☆'}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </motion.button>

              {/* Status label */}
              <p
                className={`text-center text-sm mt-2 ${
                  status === 'current' ? 'text-[#1CB0F6] font-medium' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {status === 'completed'
                  ? '✓ Completed'
                  : status === 'current'
                  ? '▶ Continue'
                  : status === 'unlocked'
                  ? 'Ready'
                  : 'Locked'}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
