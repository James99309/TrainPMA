import { useState } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '../../stores/progressStore';
import { useSound } from '../../hooks/useSound';

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

interface ChapterQuizProps {
  questions: Question[];
  onComplete: (score: number, total: number) => void;
  onClose: () => void;
}

export function ChapterQuiz({ questions, onComplete, onClose }: ChapterQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [showFailScreen, setShowFailScreen] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const { loseHeart, hearts, unlockAchievement } = useProgressStore();
  const { play } = useSound();

  const question = questions[currentIndex];
  const isCorrect = selectedIndex === question.correctIndex;
  const isLastQuestion = currentIndex === questions.length - 1;
  const passingScore = Math.ceil(questions.length * 2 / 3); // 2/3 to pass

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedIndex(index);
  };

  const handleCheck = () => {
    if (selectedIndex === null) return;
    setShowResult(true);

    if (isCorrect) {
      setScore((s) => s + 1);
      play('correct');
    } else {
      loseHeart();
      play('wrong');
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Score already includes this question's result from handleCheck
      setFinalScore(score);
      if (score >= passingScore) {
        // Achievement: Perfect score (all questions correct)
        if (score === questions.length) {
          unlockAchievement('perfect_score');
        }
        onComplete(score, questions.length);
      } else {
        setShowFailScreen(true);
        play('wrong');
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setShowResult(false);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setShowResult(false);
    setScore(0);
    setShowFailScreen(false);
    setFinalScore(0);
  };

  // Show fail screen if didn't pass
  if (showFailScreen) {
    return (
      <motion.div
        className="fixed inset-0 bg-[#FF4B4B] z-50 flex flex-col items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-6xl mb-4"
        >
          😔
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">Not quite!</h2>
        <p className="text-white/80 text-lg mb-2">
          You got {finalScore} / {questions.length} correct
        </p>
        <p className="text-white/60 text-sm mb-8">
          Need at least {passingScore} correct to pass
        </p>
        <motion.button
          onClick={handleRetry}
          className="bg-white text-[#FF4B4B] font-bold py-4 px-8 rounded-xl text-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🔄 Try Again
        </motion.button>
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
            className="text-gray-500 dark:text-gray-400"
            whileTap={{ scale: 0.95 }}
          >
            ✕
          </motion.button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currentIndex + 1} / {questions.length}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-sm">
                  {i < hearts ? '❤️' : '🤍'}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Progress */}
        <div className="max-w-2xl mx-auto mt-3">
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#58CC02]"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          {/* Question */}
          <div className="text-center mb-8">
            <span className="text-3xl mb-4 block">📝</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Comprehension Check</h2>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6">
            <p className="text-lg text-gray-800 dark:text-gray-200">{question.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {question.options.map((option, index) => {
              let buttonClass = 'bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200';

              if (selectedIndex === index && !showResult) {
                buttonClass = 'bg-blue-50 dark:bg-blue-900 border-2 border-[#1CB0F6] text-gray-800 dark:text-gray-200';
              }

              if (showResult) {
                if (index === question.correctIndex) {
                  buttonClass = 'bg-green-50 dark:bg-green-900 border-2 border-[#58CC02] text-gray-800 dark:text-gray-200';
                } else if (selectedIndex === index && !isCorrect) {
                  buttonClass = 'bg-red-50 dark:bg-red-900 border-2 border-[#FF4B4B] text-gray-800 dark:text-gray-200';
                }
              }

              return (
                <motion.button
                  key={index}
                  onClick={() => handleSelect(index)}
                  className={`w-full p-4 rounded-xl text-left font-medium ${buttonClass}`}
                  whileHover={!showResult ? { scale: 1.02 } : {}}
                  whileTap={!showResult ? { scale: 0.98 } : {}}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-sm font-bold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Result feedback */}
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl mb-6 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}
            >
              <p className={`font-bold ${isCorrect ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                {isCorrect ? '✓ Correct!' : '✗ Not quite right'}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom action */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700">
        <div className="max-w-2xl mx-auto">
          <motion.button
            onClick={showResult ? handleNext : handleCheck}
            disabled={selectedIndex === null && !showResult}
            className={`w-full font-bold py-4 rounded-xl text-lg ${
              selectedIndex === null && !showResult
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                : showResult
                ? isCorrect
                  ? 'bg-[#58CC02] text-white'
                  : 'bg-[#FF4B4B] text-white'
                : 'bg-[#1CB0F6] text-white'
            }`}
            whileHover={selectedIndex !== null || showResult ? { scale: 1.02 } : {}}
            whileTap={selectedIndex !== null || showResult ? { scale: 0.98 } : {}}
          >
            {showResult ? (isLastQuestion ? 'Finish' : 'Continue') : 'Check'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
