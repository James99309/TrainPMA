import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCourseStore } from '../../stores/courseStore';
import { useProgressStore } from '../../stores/progressStore';
import { useWrongQuestionStore } from '../../stores/wrongQuestionStore';
import { showXPToast } from '../../stores/xpToastStore';
import { surveyApi } from '../../services/surveyApi';
import type { SurveyQuestion } from '../../types';

// 奖励常量
const FIRST_PASS_XP = 30;   // 首次通过奖励
const PERFECT_SCORE_XP = 50; // 满分奖励

// 测验进度保存相关常量和类型
const QUIZ_PROGRESS_KEY = 'quiz_progress';
const PROGRESS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24小时

interface QuizProgress {
  surveyId: string;
  // 使用已答题目ID列表（因为题目顺序是随机的，不能用索引）
  answeredQuestionIds: string[];
  answers: Array<{ question_id: string; answer: string | string[]; is_correct?: boolean }>;
  savedAt: number;
}

// Fisher-Yates 洗牌算法
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 随机化题目顺序和选项顺序
function randomizeQuestions(questions: SurveyQuestion[]): SurveyQuestion[] {
  // 打乱题目顺序
  const shuffledQuestions = shuffle(questions);

  // 打乱每道题的选项顺序（填空题没有选项）
  return shuffledQuestions.map(q => {
    if (q.options && q.options.length > 0) {
      return { ...q, options: shuffle(q.options) };
    }
    return q;
  });
}

interface SurveyQuizProps {
  surveyId: string;
  courseId?: string;
  syllabusId?: string;  // 当前课程表ID，用于记录课程表内XP
  passScore?: number;
  onComplete: (result: {
    passed: boolean;
    score: number;
    maxScore: number;
    percentage: number;
  }) => void;
  onClose: () => void;
}

export function SurveyQuiz({
  surveyId,
  courseId,
  syllabusId,
  passScore = 60,
  onComplete,
  onClose,
}: SurveyQuizProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<
    Array<{ question_id: string; answer: string | string[]; is_correct?: boolean }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [showNoHeartsModal, setShowNoHeartsModal] = useState(false);
  const [nextHeartTime, setNextHeartTime] = useState<number | null>(null);

  const { surveyUserInfo, updateCourseProgress, courses, markCourseComplete, currentCourse } = useCourseStore();
  const { loseHeart, hearts, addXP, addSyllabusXP, updateStreak, recordQuizPass, recordQuizFail, completeCourse, exchangeXPForHeart, totalXP, maxHearts, lastHeartLoss, recordFirstQuizPass } = useProgressStore();
  const { addWrongQuestion } = useWrongQuestionStore();

  // 用于跟踪进度是否已恢复，避免重复处理
  const progressRestoredRef = useRef(false);

  const question = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // Load questions with randomization
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const data = await surveyApi.getQuestions(surveyId);
        if (data.length === 0) {
          setError('暂无题目');
        } else {
          // 随机化题目顺序和选项顺序
          const randomizedData = randomizeQuestions(data);
          setQuestions(randomizedData);
          console.log('[Quiz] 题目已随机化');
        }
      } catch (err) {
        setError('加载题目失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadQuestions();
  }, [surveyId]);

  // 恢复测验进度
  useEffect(() => {
    // 只在题目加载完成后恢复进度，且只执行一次
    if (questions.length === 0 || progressRestoredRef.current) return;

    const savedProgress = localStorage.getItem(QUIZ_PROGRESS_KEY);
    if (savedProgress) {
      try {
        const progress: QuizProgress = JSON.parse(savedProgress);
        // 检查是否是同一测验且在24小时有效期内
        if (
          progress.surveyId === surveyId &&
          Date.now() - progress.savedAt < PROGRESS_EXPIRY_MS
        ) {
          // 恢复已答题目的答案
          setAnswers(progress.answers);

          // 根据已答题目ID找到第一个未答的题目索引
          const answeredIds = new Set(progress.answeredQuestionIds);
          const firstUnansweredIndex = questions.findIndex(q => !answeredIds.has(q.id));

          if (firstUnansweredIndex === -1) {
            // 所有题目都已答过，从最后一题开始（理论上不应该发生）
            setCurrentIndex(questions.length - 1);
          } else {
            setCurrentIndex(firstUnansweredIndex);
          }

          console.log(`[Quiz Progress] 已恢复进度: 已答${progress.answers.length}题，从第${firstUnansweredIndex + 1}题继续`);
        } else {
          // 进度过期或不是同一测验，清除
          localStorage.removeItem(QUIZ_PROGRESS_KEY);
          console.log('[Quiz Progress] 进度已过期或不匹配，已清除');
        }
      } catch (e) {
        console.error('[Quiz Progress] 解析进度失败:', e);
        localStorage.removeItem(QUIZ_PROGRESS_KEY);
      }
    }
    progressRestoredRef.current = true;
  }, [questions, surveyId]);

  // 保存测验进度
  useEffect(() => {
    // 只有在有答案记录时才保存进度
    if (answers.length === 0) return;
    // 确保不是刚恢复进度时触发的保存
    if (!progressRestoredRef.current) return;

    // 提取已答题目的ID列表
    const answeredQuestionIds = answers.map(a => a.question_id);

    const progress: QuizProgress = {
      surveyId,
      answeredQuestionIds,
      answers,
      savedAt: Date.now(),
    };
    localStorage.setItem(QUIZ_PROGRESS_KEY, JSON.stringify(progress));
    console.log(`[Quiz Progress] 进度已保存: 已答${answers.length}题`);
  }, [surveyId, answers]);

  const checkAnswer = useCallback(() => {
    if (!question || selectedAnswer === null) return false;

    const correctAnswer = question.correct_answer;

    // 🔧 DEBUG: 打印比对信息
    console.log('=== Answer Check Debug ===');
    console.log('Question Type:', question.question_type);
    console.log('Selected Answer:', selectedAnswer, '| Type:', typeof selectedAnswer);
    console.log('Correct Answer:', correctAnswer, '| Type:', typeof correctAnswer);
    console.log('Options:', question.options);

    if (question.question_type === 'multiple_choice') {
      const selectedArr = Array.isArray(selectedAnswer) ? selectedAnswer : [selectedAnswer];
      const correctArr = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
      console.log('Multiple Choice - Selected Array:', selectedArr);
      console.log('Multiple Choice - Correct Array:', correctArr);
      const result = selectedArr.length === correctArr.length &&
        selectedArr.every((a) => correctArr.includes(a));
      console.log('Multiple Choice Result:', result);
      return result;
    }

    if (question.question_type === 'fill_blank') {
      const correct = Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer;
      const result = String(selectedAnswer).toLowerCase().trim() === String(correct).toLowerCase().trim();
      console.log('Fill Blank - Correct:', correct, '| Result:', result);
      return result;
    }

    // single_choice
    const result = selectedAnswer === correctAnswer;
    console.log('Single Choice - Direct comparison result:', result);

    // 🔧 DEBUG: 检查是否是字母 vs 文本的问题
    if (!result && question.options) {
      const selectedIndex = question.options.indexOf(selectedAnswer as string);
      const selectedLetter = selectedIndex >= 0 ? String.fromCharCode(65 + selectedIndex) : null;
      console.log('Selected Letter:', selectedLetter);
      console.log('Is correctAnswer a letter?', /^[A-D]$/i.test(String(correctAnswer)));
      if (selectedLetter && selectedLetter === String(correctAnswer).toUpperCase()) {
        console.log('⚠️ MISMATCH DETECTED: selectedAnswer is text, correctAnswer is letter!');
      }
    }

    return result;
  }, [question, selectedAnswer]);

  const handleSelectOption = (option: string) => {
    if (showResult) return;

    if (question.question_type === 'multiple_choice') {
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

    // Save answer
    setAnswers((prev) => [
      ...prev,
      {
        question_id: question.id,
        answer: selectedAnswer,
        is_correct: correct,
      },
    ]);

    if (!correct) {
      // 记录到错题本
      addWrongQuestion(
        surveyId,
        question,
        selectedAnswer,
        courseId,
        currentCourse?.title
      );

      // 扣除红心
      loseHeart();

      // 检查红心是否用完
      if (hearts - 1 <= 0) {
        // 计算下次恢复时间
        const HEART_REGEN_INTERVAL = 30 * 60 * 1000; // 30分钟
        const now = Date.now();
        const lastLoss = lastHeartLoss || now;
        const nextRegen = lastLoss + HEART_REGEN_INTERVAL;
        setNextHeartTime(nextRegen);
        setShowNoHeartsModal(true);
      }
    }
  };

  const handleNext = async () => {
    if (isLastQuestion) {
      await handleSubmit();
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setIsCorrect(false);
    }
  };

  // 清除保存的进度
  const clearQuizProgress = useCallback(() => {
    localStorage.removeItem(QUIZ_PROGRESS_KEY);
    console.log('[Quiz Progress] 进度已清除');
  }, []);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const result = await surveyApi.submitQuiz({
        survey_id: surveyId,
        user_name: surveyUserInfo?.name || 'Anonymous',
        user_company: surveyUserInfo?.company,
        user_phone: surveyUserInfo?.phone,
        answers: answers.map((a) => ({
          question_id: a.question_id,
          answer: a.answer,
        })),
      });

      const passed = result.percentage >= passScore;
      const isPerfect = result.percentage === 100;

      // Award XP and update achievements
      // XP 计算: 每题 10 XP（例如 10 题 = 100 XP）
      // 注意：每个测验只能获得一次 XP，防止重复刷分
      const baseXP = questions.length * 10;
      let xpEarned = 0;

      if (passed) {
        // 检查是否首次通过此测验
        const isFirstPass = recordFirstQuizPass(surveyId);

        // 只有首次通过才能获得 XP
        if (isFirstPass) {
          xpEarned = baseXP;

          // 发放基础XP
          addXP(xpEarned);
          // 同时记录到课程表XP (如果有课程表ID)
          if (syllabusId) {
            addSyllabusXP(syllabusId, xpEarned);
          }

          // 首次通过奖励
          addXP(FIRST_PASS_XP);
          if (syllabusId) {
            addSyllabusXP(syllabusId, FIRST_PASS_XP);
          }
          xpEarned += FIRST_PASS_XP;

          // 延迟显示避免与结果页面冲突
          setTimeout(() => {
            showXPToast({
              amount: FIRST_PASS_XP,
              reason: '首次通过测验',
              icon: '🎯',
            });
          }, 500);

          // 满分奖励（只在首次通过时判断）
          if (isPerfect) {
            addXP(PERFECT_SCORE_XP);
            if (syllabusId) {
              addSyllabusXP(syllabusId, PERFECT_SCORE_XP);
            }
            xpEarned += PERFECT_SCORE_XP;

            // 满分奖励延迟更长时间显示
            setTimeout(() => {
              showXPToast({
                amount: PERFECT_SCORE_XP,
                reason: '测验满分',
                icon: '💯',
              });
            }, 3300);
          }
        }
        // 如果不是首次通过，不发放任何 XP
        updateStreak();  // 记录学习活动，更新连续天数
        recordQuizPass(isPerfect);  // 记录测验通过，解锁相关成就
      } else {
        recordQuizFail();  // 测验失败，重置连续通过次数
      }

      // Update course progress if linked to a course
      if (courseId) {
        // 如果测验通过，同时标记课程学习完成（修复进度显示不一致问题）
        if (passed) {
          markCourseComplete(courseId);
          completeCourse(courseId, courses.length);
        }

        updateCourseProgress(courseId, {
          quizPassed: passed,
          quizScore: result.percentage,
        });
      }

      // 测验完成后清除保存的进度
      clearQuizProgress();

      onComplete({
        passed,
        score: result.total_score,
        maxScore: result.max_score,
        percentage: result.percentage,
      });
    } catch (err) {
      console.error('Submit failed:', err);
      setError('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-800 z-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className="w-16 h-16 border-4 border-[#58CC02] border-t-transparent rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-gray-500 dark:text-gray-400">加载题目中...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-800 z-50 flex items-center justify-center">
        <div className="text-center p-6">
          <span className="text-6xl">😕</span>
          <p className="text-red-500 mt-4">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-[#58CC02] text-white rounded-full font-bold"
          >
            返回
          </button>
        </div>
      </div>
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
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-sm">
                  {i < hearts ? '❤️' : '🤍'}
                </span>
              ))}
            </div>
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
              {question.question_type === 'single_choice'
                ? '📋'
                : question.question_type === 'multiple_choice'
                ? '☑️'
                : '✏️'}
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {question.question_type === 'single_choice'
                ? '单选题'
                : question.question_type === 'multiple_choice'
                ? '多选题（选择所有正确答案）'
                : '填空题'}
            </p>
          </div>

          {/* Question text */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6">
            <p className="text-lg text-gray-800 dark:text-gray-200">{question.question_text}</p>
            {question.score && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                分值: {question.score} 分
              </p>
            )}
          </div>

          {/* Options or input */}
          <AnimatePresence mode="wait">
            {question.question_type === 'fill_blank' ? (
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
                    正确答案: {question.correct_answer}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div key="options" className="space-y-3 mb-6">
                {question.options?.map((option, index) => {
                  const isSelected = Array.isArray(selectedAnswer)
                    ? selectedAnswer.includes(option)
                    : selectedAnswer === option;
                  const correctAnswer = question.correct_answer;
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
                          {question.question_type === 'multiple_choice'
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
                {isCorrect ? '✓ 回答正确!' : '✗ 回答错误'}
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
            {submitting ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ⏳
              </motion.span>
            ) : showResult ? (
              isLastQuestion ? (
                '提交答卷'
              ) : (
                '下一题'
              )
            ) : (
              '确认答案'
            )}
          </motion.button>
        </div>
      </div>

      {/* 红心用完弹窗 */}
      <AnimatePresence>
        {showNoHeartsModal && (
          <NoHeartsModal
            nextHeartTime={nextHeartTime}
            totalXP={totalXP}
            canExchange={totalXP >= 100 && hearts < maxHearts}
            onExchange={() => {
              if (exchangeXPForHeart()) {
                setShowNoHeartsModal(false);
              }
            }}
            onClose={onClose}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 红心用完弹窗组件
interface NoHeartsModalProps {
  nextHeartTime: number | null;
  totalXP: number;
  canExchange: boolean;
  onExchange: () => void;
  onClose: () => void;
}

function NoHeartsModal({
  nextHeartTime,
  totalXP,
  canExchange,
  onExchange,
  onClose,
}: NoHeartsModalProps) {
  const [countdown, setCountdown] = useState('--:--');

  useEffect(() => {
    if (!nextHeartTime) return;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, nextHeartTime - now);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextHeartTime]);

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <span className="text-6xl mb-4 block">💔</span>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          红心已用完
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          请等待恢复或使用经验值兑换
        </p>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">下次恢复</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            ⏱️ {countdown}
          </p>
        </div>

        <motion.button
          onClick={onExchange}
          disabled={!canExchange}
          className={`w-full py-3 rounded-xl font-bold mb-3 ${
            canExchange
              ? 'bg-[#1CB0F6] text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
          }`}
          whileHover={canExchange ? { scale: 1.02 } : {}}
          whileTap={canExchange ? { scale: 0.98 } : {}}
        >
          💎 100 XP → ❤️ 兑换红心
        </motion.button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          当前 XP: {totalXP}
        </p>

        <motion.button
          onClick={onClose}
          className="w-full py-3 text-gray-500 dark:text-gray-400 font-medium"
          whileTap={{ scale: 0.98 }}
        >
          返回课程列表
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
