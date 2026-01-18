import { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useVocabularyStore } from '../../stores/vocabularyStore';
import type { VocabularyItem } from '../../types';

// Swipeable word card component
function SwipeableWordCard({
  word,
  onSelect,
  onDelete,
  getMasteryColor,
  stripChineseTranslation,
  index,
}: {
  word: VocabularyItem;
  onSelect: () => void;
  onDelete: () => void;
  getMasteryColor: (level: number) => string;
  stripChineseTranslation: (text: string) => string;
  index: number;
}) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-80, -40, 0], [1, 0.5, 0]);
  const deleteScale = useTransform(x, [-80, -40, 0], [1, 0.8, 0.5]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    // If dragged far enough left, keep it open
    if (info.offset.x < -40) {
      x.set(-80);
    } else {
      x.set(0);
    }
  };

  const handleClick = () => {
    // Only trigger select if not dragging and card is not swiped open
    if (!isDragging && x.get() === 0) {
      onSelect();
    } else if (x.get() !== 0) {
      // Reset position on click when swiped
      x.set(0);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative overflow-hidden rounded-xl"
    >
      {/* Delete button background */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center"
        style={{ opacity: deleteOpacity }}
      >
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-full h-full flex items-center justify-center"
          style={{ scale: deleteScale }}
          whileTap={{ scale: 0.9 }}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </motion.button>
      </motion.div>

      {/* Card content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        style={{ x }}
        className="bg-white dark:bg-gray-800 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white">{word.word}</h3>
              {word.isSaved && <span className="text-yellow-500">⭐</span>}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{stripChineseTranslation(word.definition)}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mastery bar */}
            <div className="w-16">
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getMasteryColor(word.masteryLevel)}`}
                  style={{ width: `${word.masteryLevel}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">
                {word.masteryLevel}%
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Strip Chinese translation in parentheses from definition text
function stripChineseTranslation(text: string): string {
  if (!text) return '';
  return text.replace(/\s*\([^)]*[\u4e00-\u9fa5][^)]*\)\s*/g, '').trim();
}

type Filter = 'all' | 'saved' | 'learning' | 'mastered';

export function WordBank() {
  const { vocabulary, savedWords, getMasteredWords, getLearningWords, deleteWord } = useVocabularyStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null);

  const allWords = Object.values(vocabulary).filter(w => w.word && w.word.trim());
  const masteredWords = getMasteredWords();
  const learningWords = getLearningWords();

  const getFilteredWords = () => {
    switch (filter) {
      case 'saved':
        return allWords.filter((w) => savedWords.includes(w.word));
      case 'learning':
        return learningWords;
      case 'mastered':
        return masteredWords;
      default:
        return allWords;
    }
  };

  const filteredWords = getFilteredWords();

  const savedCount = allWords.filter((w) => savedWords.includes(w.word)).length;
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: allWords.length },
    { id: 'saved', label: 'Saved', count: savedCount },
    { id: 'learning', label: 'Learning', count: learningWords.length },
    { id: 'mastered', label: 'Mastered', count: masteredWords.length },
  ];

  const getMasteryColor = (level: number) => {
    if (level >= 80) return 'bg-[#58CC02]';
    if (level >= 50) return 'bg-[#1CB0F6]';
    if (level > 0) return 'bg-[#FF9600]';
    return 'bg-gray-200';
  };

  return (
    <div className="pt-20 pb-24 px-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">📚 Word Bank</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {filters.map((f) => (
            <motion.button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                filter === f.id
                  ? 'bg-[#58CC02] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {f.label} ({f.count})
            </motion.button>
          ))}
        </div>

        {/* Word list */}
        {filteredWords.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📖</p>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'all'
                ? 'Start reading to discover new words!'
                : `No ${filter} words yet.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWords.map((word, index) => (
              <SwipeableWordCard
                key={word.word}
                word={word}
                index={index}
                onSelect={() => setSelectedWord(word)}
                onDelete={() => deleteWord(word.word)}
                getMasteryColor={getMasteryColor}
                stripChineseTranslation={stripChineseTranslation}
              />
            ))}
          </div>
        )}

        {/* Word detail modal */}
        <AnimatePresence>
          {selectedWord && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/50 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedWord(null)}
              />
              <motion.div
                className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl z-50 p-6 max-h-[80vh] overflow-y-auto"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
              >
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {selectedWord.word}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{selectedWord.phonetic}</p>

                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">Definition</p>
                  <p className="text-gray-800 dark:text-gray-200">{stripChineseTranslation(selectedWord.definition)}</p>
                </div>

                {selectedWord.contexts.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-1">In context</p>
                    <p className="text-gray-600 dark:text-gray-300 italic">
                      "{selectedWord.contexts[0].sentence}"
                    </p>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-2">Mastery Level</p>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getMasteryColor(selectedWord.masteryLevel)}`}
                      style={{ width: `${selectedWord.masteryLevel}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>
                      {selectedWord.timesCorrect} correct / {selectedWord.timesIncorrect} incorrect
                    </span>
                    <span>{selectedWord.masteryLevel}%</span>
                  </div>
                </div>

                <motion.button
                  onClick={() => setSelectedWord(null)}
                  className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl"
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
