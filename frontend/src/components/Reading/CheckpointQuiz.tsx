import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ComprehensionQuestion } from '../../types';
import { useProgressStore } from '../../stores/progressStore';

interface CheckpointQuizProps {
  question: ComprehensionQuestion;
  onComplete: (correct: boolean) => void;
}

export function CheckpointQuiz({ question, onComplete }: CheckpointQuizProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { loseHeart } = useProgressStore();

  const isCorrect = selectedIndex === question.correctIndex;

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedIndex(index);
  };

  const handleCheck = () => {
    if (selectedIndex === null) return;
    setShowResult(true);

    if (!isCorrect) {
      loseHeart();
    }
  };

  const handleContinue = () => {
    onComplete(isCorrect);
  };

  return (
    <motion.div
      className="max-w-2xl mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      {/* Question header */}
      <div className="text-center mb-6">
        <span className="text-3xl mb-2 block">📝</span>
        <h2 className="text-xl font-bold text-gray-900">Checkpoint</h2>
        <p className="text-gray-500">Let's check your understanding</p>
      </div>

      {/* Question */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        <p className="text-lg text-gray-800">{question.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => {
          let buttonClass = 'bg-white border-2 border-gray-200 text-gray-800';

          if (selectedIndex === index && !showResult) {
            buttonClass = 'bg-blue-50 border-2 border-[#1CB0F6] text-gray-800';
          }

          if (showResult) {
            if (index === question.correctIndex) {
              buttonClass = 'bg-green-50 border-2 border-[#58CC02] text-gray-800';
            } else if (selectedIndex === index && !isCorrect) {
              buttonClass = 'bg-red-50 border-2 border-[#FF4B4B] text-gray-800';
            }
          }

          return (
            <motion.button
              key={index}
              onClick={() => handleSelect(index)}
              className={`w-full p-4 rounded-xl text-left font-medium transition-all ${buttonClass}`}
              whileHover={!showResult ? { scale: 1.02 } : {}}
              whileTap={!showResult ? { scale: 0.98 } : {}}
            >
              <span className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold">
                  {String.fromCharCode(65 + index)}
                </span>
                {option}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Result feedback */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl mb-6 ${
              isCorrect ? 'bg-green-50' : 'bg-red-50'
            }`}
          >
            <p className={`font-bold ${isCorrect ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
              {isCorrect ? '✓ Correct!' : '✗ Not quite right'}
            </p>
            <p className="text-gray-600 mt-1">{question.explanation}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action button */}
      <motion.button
        onClick={showResult ? handleContinue : handleCheck}
        disabled={selectedIndex === null && !showResult}
        className={`w-full font-bold py-4 rounded-xl text-lg transition-all ${
          selectedIndex === null && !showResult
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : showResult
            ? isCorrect
              ? 'bg-[#58CC02] text-white'
              : 'bg-[#FF4B4B] text-white'
            : 'bg-[#1CB0F6] text-white'
        }`}
        whileHover={selectedIndex !== null || showResult ? { scale: 1.02 } : {}}
        whileTap={selectedIndex !== null || showResult ? { scale: 0.98 } : {}}
      >
        {showResult ? 'Continue' : 'Check'}
      </motion.button>
    </motion.div>
  );
}
