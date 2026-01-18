import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWrongQuestionStore } from '../../stores/wrongQuestionStore';
import { useProgressStore } from '../../stores/progressStore';
import { showXPToast } from '../../stores/xpToastStore';
import type { WrongQuestion } from '../../types';

// 错题答对奖励XP
const WRONG_QUESTION_CORRECT_XP = 10;

interface WrongQuestionPracticeProps {
  questions: WrongQuestion[];
  onComplete: () => void;
  onClose: () => void;
}

interface PracticeResult {
  questionId: string;
  isCorrect: boolean;
}

export function WrongQuestionPractice({
  questions,
  onComplete,
  onClose,
}: WrongQuestionPracticeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [practiceComplete, setPracticeComplete] = useState(false);

  const { markAsResolved } = useWrongQuestionStore();
  const { addXP } = useProgressStore();

  const question = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const checkAnswer = useCallback(() => {
    if (!question || selectedAnswer === null) return false;

    const correctAnswer = question.correctAnswer;

    if (question.questionType === 'multiple_choice') {
      const selectedArr = Array.isArray(selectedAnswer) ? selectedAnswer : [selectedAnswer];
      const correctArr = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
      return (
        selectedArr.length === correctArr.length &&
        selectedArr.every((a) => correctArr.includes(a))
      );
    }

    if (question.questionType === 'fill_blank') {
      const correct = Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer;
      return String(selectedAnswer).toLowerCase().trim() === String(correct).toLowerCase().trim();
    }

    // single_choice
    return selectedAnswer === correctAnswer;
  }, [question, selectedAnswer]);

  const handleSelectOption = (option: string) => {
    if (showResult) return;

    if (question.questionType === 'multiple_choice') {
      setSelectedAnswer((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        if (current.includes(option)) {
          return current.filter((o) => o !== option);
        }
        return [...current, option];
      });
    } else {
      setSelectedAnswer(option);
    }
  };

  const handleFillBlankChange = (value: string) => {
    if (showResult) return;
    setSelectedAnswer(value);
  };

  const handleCheck = () => {
    if (selectedAnswer === null || (Array.isArray(selectedAnswer) && selectedAnswer.length === 0))
      return;

    const correct = checkAnswer();
    setIsCorrect(correct);
    setShowResult(true);

    // 保存结果
    setResults((prev) => [
      ...prev,
      { questionId: question.id, isCorrect: correct },
    ]);

    // 如果答对了，标记为已掌握并奖励XP
    if (correct) {
      markAsResolved(question.id);
      addXP(WRONG_QUESTION_CORRECT_XP);
      showXPToast({
        amount: WRONG_QUESTION_CORRECT_XP,
        reason: '错题答对',
        icon: '✅',
      });
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // 练习完成
      setPracticeComplete(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setIsCorrect(false);
    }
  };

  // 练习完成页面
  if (practiceComplete) {
    const correctCount = results.filter((r) => r.isCorrect).length;
    const totalCount = results.length;
    const percentage = Math.round((correctCount / totalCount) * 100);

    return (
      <motion.div
        className="fixed inset-0 bg-white dark:bg-gray-800 z-50 flex flex-col items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center max-w-md">
          <span className="text-6xl mb-4 block">
            {percentage >= 80 ? '🎉' : percentage >= 60 ? '👍' : '💪'}
          </span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            练习完成！
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            本次练习答对了 {correctCount} / {totalCount} 题
          </p>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 mb-6">
            <div className="text-4xl font-bold text-[#58CC02] mb-2">{percentage}%</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">正确率</p>
          </div>

          {correctCount > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 mb-4">
              ✅ 已将 {correctCount} 道答对的题目标记为"已掌握"
            </p>
          )}

          <motion.button
            onClick={onComplete}
            className="w-full py-4 bg-[#58CC02] text-white font-bold rounded-xl text-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            返回错题本
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 bg-white dark:bg-gray-800 z-50 flex flex-col"
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <motion.button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 text-2xl"
            whileTap={{ scale: 0.95 }}
          >
            ✕
          </motion.button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currentIndex + 1} / {questions.length}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">
              📝 错题练习
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-3">
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#58CC02]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          {/* Question type indicator */}
          <div className="text-center mb-6">
            <span className="text-3xl mb-2 block">
              {question.questionType === 'single_choice'
                ? '📋'
                : question.questionType === 'multiple_choice'
                ? '☑️'
                : '✏️'}
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {question.questionType === 'single_choice'
                ? '单选题'
                : question.questionType === 'multiple_choice'
                ? '多选题（选择所有正确答案）'
                : '填空题'}
            </p>
            <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">
              你曾答错 {question.wrongCount} 次
            </p>
          </div>

          {/* Question text */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6">
            <p className="text-lg text-gray-800 dark:text-gray-200">{question.questionText}</p>
            {question.score && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                分值: {question.score} 分
              </p>
            )}
          </div>

          {/* Options or input */}
          <AnimatePresence mode="wait">
            {question.questionType === 'fill_blank' ? (
              <motion.div
                key="fill_blank"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6"
              >
                <input
                  type="text"
                  value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
                  onChange={(e) => handleFillBlankChange(e.target.value)}
                  disabled={showResult}
                  placeholder="请输入答案..."
                  className={`w-full p-4 rounded-xl border-2 text-lg font-medium outline-none transition ${
                    showResult
                      ? isCorrect
                        ? 'border-[#58CC02] bg-green-50 dark:bg-green-900/20'
                        : 'border-[#FF4B4B] bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:border-[#1CB0F6]'
                  } text-gray-800 dark:text-gray-200`}
                />
                {showResult && !isCorrect && (
                  <p className="mt-2 text-sm text-[#58CC02]">
                    正确答案: {question.correctAnswer}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div key="options" className="space-y-3 mb-6">
                {question.options?.map((option, index) => {
                  const isSelected = Array.isArray(selectedAnswer)
                    ? selectedAnswer.includes(option)
                    : selectedAnswer === option;
                  const correctAnswer = question.correctAnswer;
                  const isOptionCorrect = Array.isArray(correctAnswer)
                    ? correctAnswer.includes(option)
                    : correctAnswer === option;

                  let buttonClass =
                    'bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600';

                  if (isSelected && !showResult) {
                    buttonClass = 'bg-blue-50 dark:bg-blue-900 border-2 border-[#1CB0F6]';
                  }

                  if (showResult) {
                    if (isOptionCorrect) {
                      buttonClass = 'bg-green-50 dark:bg-green-900/30 border-2 border-[#58CC02]';
                    } else if (isSelected && !isOptionCorrect) {
                      buttonClass = 'bg-red-50 dark:bg-red-900/30 border-2 border-[#FF4B4B]';
                    }
                  }

                  return (
                    <motion.button
                      key={index}
                      onClick={() => handleSelectOption(option)}
                      className={`w-full p-4 rounded-xl text-left font-medium ${buttonClass} text-gray-800 dark:text-gray-200`}
                      whileHover={!showResult ? { scale: 1.01 } : {}}
                      whileTap={!showResult ? { scale: 0.99 } : {}}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            isSelected
                              ? 'bg-[#1CB0F6] text-white'
                              : 'bg-gray-100 dark:bg-gray-600'
                          }`}
                        >
                          {question.questionType === 'multiple_choice'
                            ? isSelected
                              ? '✓'
                              : ''
                            : String.fromCharCode(65 + index)}
                        </span>
                        {option}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result feedback */}
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl mb-6 ${
                isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
              }`}
            >
              <p className={`font-bold ${isCorrect ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                {isCorrect ? '✓ 回答正确！已标记为掌握' : '✗ 回答错误，再接再厉！'}
              </p>
              {question.explanation && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {question.explanation}
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom action */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700">
        <div className="max-w-2xl mx-auto">
          <motion.button
            onClick={showResult ? handleNext : handleCheck}
            disabled={
              (selectedAnswer === null ||
                (Array.isArray(selectedAnswer) && selectedAnswer.length === 0) ||
                (typeof selectedAnswer === 'string' && selectedAnswer.trim() === '')) &&
              !showResult
            }
            className={`w-full font-bold py-4 rounded-xl text-lg transition ${
              (selectedAnswer === null ||
                (Array.isArray(selectedAnswer) && selectedAnswer.length === 0) ||
                (typeof selectedAnswer === 'string' && selectedAnswer.trim() === '')) &&
              !showResult
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                : showResult
                ? isCorrect
                  ? 'bg-[#58CC02] text-white'
                  : 'bg-[#FF4B4B] text-white'
                : 'bg-[#1CB0F6] text-white'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {showResult ? (isLastQuestion ? '完成练习' : '下一题') : '确认答案'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
