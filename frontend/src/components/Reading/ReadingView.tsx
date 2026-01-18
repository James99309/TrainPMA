import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordCard } from './WordCard';
import { ChapterQuiz } from './ChapterQuiz';
import { useProgressStore } from '../../stores/progressStore';
import { useSound } from '../../hooks/useSound';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';

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

interface ReadingViewProps {
  chapter: Chapter;
  onComplete: () => void;
  onQuizComplete?: (score: string) => void;
  onBack: () => void;
}

export function ReadingView({ chapter, onComplete, onQuizComplete, onBack }: ReadingViewProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [showQuiz, setShowQuiz] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [pressedParagraph, setPressedParagraph] = useState<number | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardedSegmentsRef = useRef(0);
  const { setCurrentPosition, addXP, startSession, endSession, session } = useProgressStore();
  const { play } = useSound();
  const { speak, stop, isSpeaking } = useTextToSpeech();

  // Start session when component mounts, end when unmounts
  useEffect(() => {
    startSession(chapter.id, 0);
    return () => {
      endSession();
      stop();
    };
  }, [chapter.id, startSession, endSession, stop]);

  // Time-based XP reward: 50 XP every 10 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      if (session?.startTime) {
        const elapsedMs = Date.now() - session.startTime;
        const segments = Math.floor(elapsedMs / (10 * 60 * 1000)); // 10-minute segments

        if (segments > rewardedSegmentsRef.current) {
          const newSegments = segments - rewardedSegmentsRef.current;
          addXP(newSegments * 50);
          rewardedSegmentsRef.current = segments;
          play('correct'); // Play sound for XP reward
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(timer);
  }, [session, addXP, play]);

  const handleReadAloud = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(chapter.content);
    }
  };

  // Long press handlers for paragraph reading
  const handleParagraphTouchStart = (text: string, index: number) => {
    pressTimerRef.current = setTimeout(() => {
      setPressedParagraph(index);
      speak(text);
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms long press
  };

  const handleParagraphTouchEnd = () => {
    // Clear the timer if still waiting
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    // Stop any playing/loading audio when finger is released
    if (pressedParagraph !== null) {
      stop();
    }
    setPressedParagraph(null);
  };

  // Track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const progress = scrollTop / (scrollHeight - clientHeight);
        setScrollProgress(Math.min(1, Math.max(0, progress)));
      }
    };

    const element = contentRef.current;
    if (element) {
      element.addEventListener('scroll', handleScroll);
      return () => element.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleWordClick = (word: string, sentence: string) => {
    // Clean the word (remove punctuation)
    const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
    if (cleanWord.length > 1) {
      setSelectedWord(cleanWord);
      setSelectedContext(sentence);
    }
  };

  const handleComplete = () => {
    setCurrentPosition(chapter.id + 1, 0);
    play('complete');
    onComplete();
  };

  const handleQuizComplete = (score: number, total: number) => {
    const bonusXP = Math.round((score / total) * 30);
    addXP(bonusXP);
    if (score === total) {
      play('achievement');
    } else if (score > 0) {
      play('correct');
    }
    setShowQuiz(false);
    setCurrentPosition(chapter.id + 1, 0);
    play('complete');

    // Call onQuizComplete with score string
    if (onQuizComplete) {
      onQuizComplete(`${score}/${total}`);
    } else {
      onComplete();
    }
  };

  const handleStartQuiz = () => {
    if (chapter.quiz && chapter.quiz.length > 0) {
      setShowQuiz(true);
    } else {
      handleComplete();
    }
  };

  // Split content into paragraphs
  const paragraphs = chapter.content.split('\n\n').filter((p) => p.trim());

  // Render a paragraph with clickable words
  const renderParagraph = (text: string, index: number) => {
    // Split into sentences for context
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const isPressed = pressedParagraph === index;

    return (
      <motion.p
        key={index}
        className={`text-lg text-gray-800 dark:text-gray-200 leading-relaxed mb-6 select-none reading-content rounded-lg transition-colors ${
          isPressed ? 'bg-blue-50 dark:bg-blue-900' : ''
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.05, 0.5) }}
        onTouchStart={() => handleParagraphTouchStart(text, index)}
        onTouchEnd={handleParagraphTouchEnd}
        onTouchCancel={handleParagraphTouchEnd}
        onMouseDown={() => handleParagraphTouchStart(text, index)}
        onMouseUp={handleParagraphTouchEnd}
        onMouseLeave={handleParagraphTouchEnd}
      >
        {sentences.map((sentence, sIndex) => {
          const words = sentence.split(/(\s+)/);
          return (
            <span key={sIndex}>
              {words.map((word, wIndex) => {
                const isWhitespace = /^\s+$/.test(word);
                if (isWhitespace) {
                  return <span key={wIndex}>{word}</span>;
                }

                return (
                  <span
                    key={wIndex}
                    onClick={() => handleWordClick(word, sentence.trim())}
                    className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 hover:text-[#1CB0F6] rounded px-0.5 transition-colors"
                  >
                    {word}
                  </span>
                );
              })}
            </span>
          );
        })}
      </motion.p>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 z-40 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <motion.button
            onClick={onBack}
            className="text-gray-500 dark:text-gray-400 font-medium"
            whileTap={{ scale: 0.95 }}
          >
            ← Back
          </motion.button>
          <span className="font-bold text-gray-900 dark:text-white text-sm truncate max-w-[120px]">{chapter.title}</span>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleReadAloud}
              className={`text-lg ${isSpeaking ? 'text-[#FF4B4B]' : 'text-[#1CB0F6]'}`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title={isSpeaking ? 'Stop reading' : 'Read aloud'}
            >
              {isSpeaking ? '🔇' : '🔊'}
            </motion.button>
            {chapter.quiz && chapter.quiz.length > 0 && (
              <motion.button
                onClick={() => setShowQuiz(true)}
                className="text-[#1CB0F6]"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                📝
              </motion.button>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-700">
          <motion.div
            className="h-full bg-[#58CC02]"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
      </header>

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto pt-20 pb-32 px-4"
      >
        <div className="max-w-2xl mx-auto">
          {paragraphs.map((para, i) => renderParagraph(para, i))}

          {/* End of chapter */}
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-gray-400 dark:text-gray-500 text-sm">— End of {chapter.title} —</p>
          </motion.div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 p-4">
        <div className="max-w-2xl mx-auto">
          {chapter.quiz && chapter.quiz.length > 0 ? (
            <motion.button
              onClick={handleStartQuiz}
              className="w-full bg-[#1CB0F6] text-white font-bold py-4 rounded-xl text-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              📝 Take Quiz to Complete
            </motion.button>
          ) : (
            <motion.button
              onClick={handleComplete}
              className="w-full bg-[#58CC02] text-white font-bold py-4 rounded-xl text-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Complete +50 XP
            </motion.button>
          )}
        </div>
      </div>

      {/* Word card modal */}
      <WordCard
        word={selectedWord || ''}
        context={selectedContext}
        isOpen={!!selectedWord}
        onClose={() => setSelectedWord(null)}
      />

      {/* Quiz modal */}
      <AnimatePresence>
        {showQuiz && chapter.quiz && (
          <ChapterQuiz
            questions={chapter.quiz}
            onComplete={handleQuizComplete}
            onClose={() => setShowQuiz(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
