import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getWordDefinition } from '../../services/dictionaryApi';
import { getWordDefinitionWithClaude, type ClaudeWordDefinition } from '../../services/claudeApi';
import { useVocabularyStore } from '../../stores/vocabularyStore';
import { useProgressStore } from '../../stores/progressStore';
import { useSound } from '../../hooks/useSound';

interface WordCardProps {
  word: string;
  context?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function WordCard({ word, context, isOpen, onClose }: WordCardProps) {
  const [claudeDefinition, setClaudeDefinition] = useState<ClaudeWordDefinition | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [phonetic, setPhonetic] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { saveWord, unsaveWord, savedWords, initializeWord } = useVocabularyStore();
  const { addXP, addLearnedWord } = useProgressStore();
  const { play, playWordAudio } = useSound();

  // Check if word is saved
  useEffect(() => {
    setIsSaved(savedWords.includes(word.toLowerCase()));
  }, [word, savedWords]);

  // Fetch definition from Claude and audio from Dictionary API
  useEffect(() => {
    if (isOpen && word) {
      setLoading(true);
      setClaudeDefinition(null);
      setAudioUrl(null);

      // Fetch Claude definition and Dictionary audio in parallel
      Promise.all([
        getWordDefinitionWithClaude(word, context),
        getWordDefinition(word),
      ]).then(([claudeDef, dictDef]) => {
        setClaudeDefinition(claudeDef);
        // Get audio and phonetic from Dictionary API
        if (dictDef) {
          setAudioUrl(dictDef.audio);
          setPhonetic(dictDef.phonetic);
        }
        setLoading(false);
      });
    }
  }, [isOpen, word, context]);

  const handlePlayAudio = () => {
    if (audioUrl) {
      playWordAudio(audioUrl);
    }
  };

  const handleGotIt = () => {
    // Save word to vocabulary with Claude definition
    if (claudeDefinition) {
      initializeWord({
        word: claudeDefinition.word,
        definition: `${claudeDefinition.english} (${claudeDefinition.chinese})`,
        pronunciation: audioUrl || '',
        phonetic: phonetic,
        partOfSpeech: claudeDefinition.partOfSpeech,
        contexts: context ? [{ sentence: context, chapterId: 0 }] : [],
        similarWords: [],
        masteryLevel: 0,
        lastReviewed: null,
        nextReview: null,
        timesCorrect: 1,
        timesIncorrect: 0,
        isNew: true,
        isSaved: false,
      });
    }
    addXP(5);
    addLearnedWord(word.toLowerCase());
    play('xp');
    onClose();
  };

  const handleSave = () => {
    const cleanWord = word.toLowerCase();
    if (isSaved) {
      unsaveWord(cleanWord);
    } else {
      // 收藏时确保单词已初始化到词库
      if (claudeDefinition) {
        initializeWord({
          word: cleanWord,
          definition: `${claudeDefinition.english} (${claudeDefinition.chinese})`,
          pronunciation: audioUrl || '',
          phonetic: phonetic,
          partOfSpeech: claudeDefinition.partOfSpeech,
          contexts: context ? [{ sentence: context, chapterId: 0 }] : [],
          similarWords: [],
          masteryLevel: 0,
          lastReviewed: null,
          nextReview: null,
          timesCorrect: 0,
          timesIncorrect: 0,
          isNew: true,
          isSaved: true,
        });
      }
      saveWord(cleanWord);
      play('click');
    }
    setIsSaved(!isSaved);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl z-50 p-6 max-h-[80vh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <motion.div
                  className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-[#58CC02] rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <p className="text-gray-500 dark:text-gray-400 mt-4">Looking up "{word}"...</p>
              </div>
            ) : claudeDefinition ? (
              <>
                {/* Word and pronunciation */}
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{word}</h2>
                    {audioUrl && (
                      <motion.button
                        onClick={handlePlayAudio}
                        className="w-10 h-10 bg-[#1CB0F6] rounded-full flex items-center justify-center text-white"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        🔊
                      </motion.button>
                    )}
                  </div>
                  {phonetic && <p className="text-gray-500 dark:text-gray-400 text-lg">{phonetic}</p>}
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">{claudeDefinition.partOfSpeech}</p>
                </div>

                {/* Context box */}
                {context && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">📖 In context:</p>
                    <p className="text-gray-700 dark:text-gray-300 italic">"{context}"</p>
                  </div>
                )}

                {/* Definition */}
                <div className="mb-6">
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Meaning:</p>
                  <p className="text-gray-800 dark:text-gray-200 text-lg">{claudeDefinition.english}</p>
                  <p className="text-[#1CB0F6] text-lg mt-2 font-medium">
                    中文: {claudeDefinition.chinese}
                  </p>
                  {/* Translation source */}
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    <span>Powered by Claude AI</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <motion.button
                    onClick={handleGotIt}
                    className="flex-1 bg-[#58CC02] text-white font-bold py-4 rounded-xl"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    💡 Got it!
                  </motion.button>
                  <motion.button
                    onClick={handleSave}
                    className={`px-6 py-4 rounded-xl font-bold ${
                      isSaved
                        ? 'bg-yellow-100 text-yellow-600'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isSaved ? '⭐' : '☆'}
                  </motion.button>
                </div>

                {/* XP indicator */}
                <motion.p
                  className="text-right text-sm text-[#58CC02] mt-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  +5 XP 💎
                </motion.p>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-4xl mb-4">🤔</p>
                <p className="text-gray-600 dark:text-gray-400 font-medium">{word}</p>
                <p className="text-gray-400 dark:text-gray-500 mt-2">No definition found for this word.</p>
                <motion.button
                  onClick={onClose}
                  className="mt-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-8 rounded-xl"
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
