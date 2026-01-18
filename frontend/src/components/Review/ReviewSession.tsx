import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVocabularyStore } from '../../stores/vocabularyStore';
import { useProgressStore } from '../../stores/progressStore';
import { useSound } from '../../hooks/useSound';
import type { VocabularyItem } from '../../types';

type QuestionType = 'meaning' | 'sentence_context' | 'chinese_to_word' | 'fill_blank' | 'listening';

// Strip Chinese translation in parentheses from definition text
function stripChineseTranslation(text: string): string {
  if (!text) return '';
  return text.replace(/\s*\([^)]*[\u4e00-\u9fa5][^)]*\)\s*/g, '').trim();
}

// Extract Chinese translation from definition text
function extractChineseTranslation(text: string): string {
  if (!text) return '';
  const match = text.match(/\(([^)]*[\u4e00-\u9fa5][^)]*)\)/);
  return match ? match[1] : '';
}

// Escape special regex characters
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Question {
  type: QuestionType;
  word: VocabularyItem;
  question: string;
  sentence?: string; // 原文句子（用于 sentence_context 和 fill_blank 题型）
  options?: string[]; // 选择题选项
  correctIndex?: number; // 正确答案索引
  correctAnswer?: string; // 正确答案文本（用于听写题）
  audioUrl?: string; // 发音 URL（用于听写题）
}

function generateQuestion(word: VocabularyItem, allWords: VocabularyItem[]): Question {
  // 检查单词可用的题型
  const hasContext = word.contexts?.length > 0 && word.contexts[0]?.sentence;
  const hasChinese = extractChineseTranslation(word.definition) !== '';
  const hasAudio = word.pronunciation && word.pronunciation.length > 0;

  // 构建可用题型列表
  const availableTypes: QuestionType[] = ['meaning'];
  if (hasContext) {
    availableTypes.push('sentence_context', 'fill_blank');
  }
  if (hasChinese) {
    availableTypes.push('chinese_to_word');
  }
  if (hasAudio) {
    availableTypes.push('listening');
  }

  // 随机选择题型
  const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

  // Get other words for wrong answers
  let otherWords = allWords.filter((w) => w.word !== word.word && w.definition).slice(0, 3);
  const dummyOptions = ['something else', 'another meaning', 'different concept'];
  const dummyWords = ['example', 'sample', 'other'];
  while (otherWords.length < 3) {
    otherWords.push({
      ...word,
      word: dummyWords[otherWords.length] || 'option',
      definition: dummyOptions[otherWords.length] || 'A different meaning',
    });
  }

  switch (type) {
    case 'chinese_to_word': {
      // 中译英：显示中文，选择英文单词
      const chineseTranslation = extractChineseTranslation(word.definition);
      const correctAnswer = word.word;
      const options = [correctAnswer, ...otherWords.map((w) => w.word)];
      const shuffled = options.sort(() => Math.random() - 0.5);
      return {
        type,
        word,
        question: `哪个单词的意思是 "${chineseTranslation}"？`,
        options: shuffled,
        correctIndex: shuffled.indexOf(correctAnswer),
      };
    }

    case 'fill_blank': {
      // 填空题：句子中单词变成空格
      const context = word.contexts[0];
      const sentence = context.sentence.replace(
        new RegExp(`\\b${escapeRegExp(word.word)}\\b`, 'gi'),
        '______'
      );
      const correctAnswer = word.word;
      const options = [correctAnswer, ...otherWords.map((w) => w.word)];
      const shuffled = options.sort(() => Math.random() - 0.5);
      return {
        type,
        word,
        question: '选择正确的单词填入空格：',
        sentence,
        options: shuffled,
        correctIndex: shuffled.indexOf(correctAnswer),
      };
    }

    case 'listening': {
      // 听写题：播放发音，输入拼写
      return {
        type,
        word,
        question: '听发音，输入单词拼写：',
        audioUrl: word.pronunciation,
        correctAnswer: word.word.toLowerCase(),
      };
    }

    case 'sentence_context': {
      // 显示原文句子，问单词意思
      const context = word.contexts[0];
      const correctAnswer = stripChineseTranslation(word.definition);
      const options = [correctAnswer, ...otherWords.map((w) => stripChineseTranslation(w.definition))];
      const shuffled = options.sort(() => Math.random() - 0.5);
      return {
        type,
        word,
        question: `"${word.word}" 在这个句子中是什么意思？`,
        sentence: context.sentence,
        options: shuffled,
        correctIndex: shuffled.indexOf(correctAnswer),
      };
    }

    case 'meaning':
    default: {
      const correctAnswer = stripChineseTranslation(word.definition);
      const options = [correctAnswer, ...otherWords.map((w) => stripChineseTranslation(w.definition))];
      const shuffled = options.sort(() => Math.random() - 0.5);
      return {
        type: 'meaning',
        word,
        question: `What does "${word.word}" mean?`,
        options: shuffled,
        correctIndex: shuffled.indexOf(correctAnswer),
      };
    }
  }
}

interface ReviewSessionProps {
  onDone?: () => void;
}

export function ReviewSession({ onDone }: ReviewSessionProps) {
  const { getWordsForReview, recordAnswer, vocabulary } = useVocabularyStore();
  const { addXP, loseHeart, hearts } = useProgressStore();
  const { play } = useSound();

  // Store words for review in state so it doesn't change mid-session
  const [wordsForReview] = useState(() => getWordsForReview());
  // 缓存 allWords 在组件初始化时，避免 vocabulary 更新导致重新计算
  const [allWordsCache] = useState(() => Object.values(vocabulary));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 所有 hooks 必须在任何条件 return 之前调用
  const currentWord = wordsForReview[currentIndex];
  // 使用 useState 缓存问题，只在 currentIndex 改变时重新生成
  const [question, setQuestion] = useState<Question | null>(() =>
    currentWord ? generateQuestion(currentWord, allWordsCache) : null
  );

  // 当 currentIndex 改变时重新生成问题
  const prevIndexRef = useRef(currentIndex);
  if (prevIndexRef.current !== currentIndex) {
    prevIndexRef.current = currentIndex;
    const newWord = wordsForReview[currentIndex];
    if (newWord) {
      setQuestion(generateQuestion(newWord, allWordsCache));
    }
  }

  // Early returns 放在所有 hooks 之后
  if (wordsForReview.length === 0) {
    return (
      <div className="pt-20 pb-24 px-4 min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-6xl mb-4"
        >
          ✨
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">All caught up!</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center">
          No words to review right now.<br />
          Keep reading to discover new vocabulary!
        </p>
      </div>
    );
  }

  if (isComplete) {
    const scorePercent = wordsForReview.length > 0 ? (correctCount / wordsForReview.length) * 100 : 0;
    const isGood = scorePercent >= 70;
    const isPerfect = scorePercent === 100;

    return (
      <div className={`pt-20 pb-24 px-4 min-h-screen flex flex-col items-center justify-center ${
        isGood ? 'bg-[#58CC02]' : 'bg-[#FF9600]'
      }`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-6xl mb-4"
        >
          {isPerfect ? '🎉' : isGood ? '👍' : '💪'}
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isPerfect ? 'Perfect!' : isGood ? 'Great job!' : 'Keep practicing!'}
        </h2>
        <p className="text-white/80 text-lg mb-6">
          {correctCount} / {wordsForReview.length} correct
        </p>
        <motion.button
          onClick={() => onDone?.()}
          className={`bg-white font-bold py-3 px-8 rounded-xl ${
            isGood ? 'text-[#58CC02]' : 'text-[#FF9600]'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Done
        </motion.button>
      </div>
    );
  }

  // Safety check - if question couldn't be generated, show error
  if (!question) {
    return (
      <div className="pt-20 pb-24 px-4 min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
        <p className="text-red-500">Error: Could not generate question</p>
        <p className="text-gray-500">currentIndex: {currentIndex}</p>
        <p className="text-gray-500">wordsForReview.length: {wordsForReview.length}</p>
      </div>
    );
  }

  // 计算是否正确（根据题型）
  const isCorrect = question.type === 'listening'
    ? typedAnswer.toLowerCase().trim() === question.correctAnswer
    : selectedIndex === question.correctIndex;

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedIndex(index);
  };

  const handlePlayAudio = () => {
    if (question.audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(question.audioUrl);
      audioRef.current = audio;
      audio.play().catch(console.error);
    }
  };

  const handleCheck = () => {
    // 检查是否可以提交
    if (question.type === 'listening') {
      if (!typedAnswer.trim()) return;
    } else {
      if (selectedIndex === null) return;
    }

    setShowResult(true);
    recordAnswer(currentWord.word, isCorrect);

    if (isCorrect) {
      addXP(10);
      setCorrectCount((c) => c + 1);
      play('correct');
    } else {
      loseHeart();
      play('wrong');
    }
  };

  const handleNext = () => {
    if (currentIndex < wordsForReview.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setTypedAnswer('');
      setShowResult(false);
    } else {
      setIsComplete(true);
    }
  };

  return (
    <div className="pt-20 pb-24 px-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span>Review Progress</span>
            <span>{currentIndex + 1} / {wordsForReview.length}</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#58CC02]"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / wordsForReview.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Hearts */}
        <div className="flex justify-center gap-1 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="text-xl">
              {i < hearts ? '❤️' : '🤍'}
            </span>
          ))}
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {question.type === 'sentence_context' && '在句子中理解单词:'}
                {question.type === 'meaning' && 'Select the correct answer:'}
                {question.type === 'chinese_to_word' && '中译英:'}
                {question.type === 'fill_blank' && '填空题:'}
                {question.type === 'listening' && '听写题:'}
              </p>
              <p className="text-xl text-gray-900 dark:text-white">{question.question}</p>

              {/* 显示原文句子（sentence_context 题型 - 高亮单词） */}
              {question.type === 'sentence_context' && question.sentence && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border-l-4 border-[#1CB0F6]">
                  <p className="text-gray-700 dark:text-gray-200 italic leading-relaxed">
                    "{question.sentence.split(new RegExp(`(${escapeRegExp(question.word.word)})`, 'gi')).map((part, i) =>
                      part.toLowerCase() === question.word.word.toLowerCase() ? (
                        <span key={i} className="font-bold text-[#1CB0F6] not-italic">{part}</span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}"
                  </p>
                </div>
              )}

              {/* 填空题句子（不高亮，显示空格） */}
              {question.type === 'fill_blank' && question.sentence && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border-l-4 border-[#FF9600]">
                  <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                    "{question.sentence}"
                  </p>
                </div>
              )}

              {/* 听写题音频按钮 */}
              {question.type === 'listening' && (
                <div className="mt-4 flex justify-center">
                  <motion.button
                    onClick={handlePlayAudio}
                    className="w-20 h-20 bg-[#1CB0F6] rounded-full flex items-center justify-center text-white text-3xl shadow-lg"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    🔊
                  </motion.button>
                </div>
              )}
            </div>

            {/* Options (for multiple choice questions) */}
            {question.options && (
              <div className="space-y-3 mb-6">
                {question.options.map((option, index) => {
                  let buttonClass = 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700';

                  if (selectedIndex === index && !showResult) {
                    buttonClass = 'bg-blue-50 border-2 border-[#1CB0F6]';
                  }

                  if (showResult) {
                    if (index === question.correctIndex) {
                      buttonClass = 'bg-green-50 border-2 border-[#58CC02]';
                    } else if (selectedIndex === index) {
                      buttonClass = 'bg-red-50 border-2 border-[#FF4B4B]';
                    }
                  }

                  return (
                    <motion.button
                      key={index}
                      onClick={() => handleSelect(index)}
                      className={`w-full p-4 rounded-xl text-left ${buttonClass}`}
                      whileHover={!showResult ? { scale: 1.02 } : {}}
                      whileTap={!showResult ? { scale: 0.98 } : {}}
                    >
                      {option}
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Input (for listening questions) */}
            {question.type === 'listening' && (
              <div className="mb-6">
                <input
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !showResult && handleCheck()}
                  disabled={showResult}
                  placeholder="输入你听到的单词..."
                  className={`w-full p-4 rounded-xl text-lg border-2 outline-none transition-colors ${
                    showResult
                      ? isCorrect
                        ? 'border-[#58CC02] bg-green-50 dark:bg-green-900/30'
                        : 'border-[#FF4B4B] bg-red-50 dark:bg-red-900/30'
                      : 'border-gray-200 dark:border-gray-700 focus:border-[#1CB0F6] bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                  }`}
                  autoFocus
                />
                {showResult && !isCorrect && (
                  <p className="mt-2 text-[#58CC02] font-medium">
                    正确答案: {question.correctAnswer}
                  </p>
                )}
              </div>
            )}

            {/* Result */}
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl mb-6 ${isCorrect ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}
              >
                <p className={`font-bold ${isCorrect ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                  {isCorrect ? '✓ Correct! +10 XP' : '✗ Not quite right'}
                </p>
              </motion.div>
            )}

            {/* Action button */}
            {(() => {
              const canCheck = question.type === 'listening'
                ? typedAnswer.trim() !== ''
                : selectedIndex !== null;
              return (
                <motion.button
                  onClick={showResult ? handleNext : handleCheck}
                  disabled={!canCheck && !showResult}
                  className={`w-full font-bold py-4 rounded-xl text-lg ${
                    !canCheck && !showResult
                      ? 'bg-gray-200 text-gray-400'
                      : showResult
                      ? 'bg-[#58CC02] text-white'
                      : 'bg-[#1CB0F6] text-white'
                  }`}
                  whileHover={canCheck || showResult ? { scale: 1.02 } : {}}
                  whileTap={canCheck || showResult ? { scale: 0.98 } : {}}
                >
                  {showResult ? 'Continue' : 'Check'}
                </motion.button>
              );
            })()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
