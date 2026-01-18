import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCourseStore } from '../../stores/courseStore';
import type { Course } from '../../types';
import { PDFViewer } from './PDFViewer';
import { PPTViewer } from './PPTViewer';

type CourseViewState = 'overview' | 'learning' | 'quiz' | 'complete';

interface CourseViewProps {
  course: Course;
  onBack: () => void;
  onStartQuiz: (surveyId: string) => void;
  onComplete: () => void;
}

export function CourseView({ course, onBack, onStartQuiz, onComplete }: CourseViewProps) {
  const [viewState, setViewState] = useState<CourseViewState>('overview');
  const { getCourseProgress } = useCourseStore();

  const progress = getCourseProgress(course.id);
  // 如果测验已通过，也视为学习完成（修复状态不一致问题）
  const isLearningComplete = progress?.isCompleted || progress?.quizPassed || false;
  const hasQuiz = !!course.quiz?.survey_id;

  const handleStartLearning = () => {
    setViewState('learning');
  };

  const handleLearningComplete = () => {
    if (hasQuiz) {
      setViewState('overview');
    } else {
      onComplete();
    }
  };

  const handleStartQuiz = () => {
    if (course.quiz?.survey_id) {
      onStartQuiz(course.quiz.survey_id);
    }
  };

  // Show the appropriate viewer based on course type
  if (viewState === 'learning') {
    switch (course.type) {
      case 'pdf':
        return (
          <PDFViewer
            course={course}
            onComplete={handleLearningComplete}
            onBack={() => setViewState('overview')}
          />
        );
      case 'ppt':
        return (
          <PPTViewer
            course={course}
            onComplete={handleLearningComplete}
            onBack={() => setViewState('overview')}
          />
        );
      default:
        // Text type - show simple content view
        return (
          <div className="fixed inset-0 bg-white dark:bg-gray-900 overflow-auto p-6">
            <button
              onClick={() => setViewState('overview')}
              className="mb-4 text-[#58CC02] font-medium"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              {course.title}
            </h1>
            <div className="prose dark:prose-invert max-w-none">
              {course.content || '暂无内容'}
            </div>
            <button
              onClick={handleLearningComplete}
              className="mt-8 w-full py-4 bg-[#58CC02] text-white rounded-xl font-bold"
            >
              完成阅读
            </button>
          </div>
        );
    }
  }

  // Course overview page
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with back button */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          >
            <span className="text-2xl">←</span>
          </button>
          <h1 className="ml-2 text-lg font-bold text-gray-900 dark:text-white truncate">
            {course.title}
          </h1>
        </div>
      </div>

      {/* Course info card */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
        >
          {/* Thumbnail or icon */}
          <div className="h-48 bg-gradient-to-br from-[#58CC02] to-[#1CB0F6] flex items-center justify-center">
            <span className="text-8xl">
              {course.type === 'pdf' ? '📄' : course.type === 'ppt' ? '📊' : '📖'}
            </span>
          </div>

          {/* Course details */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">
                {course.type}
              </span>
              {course.duration_minutes && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  约 {course.duration_minutes} 分钟
                </span>
              )}
              {course.totalPages && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  · {course.totalPages} 页
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {course.title}
            </h2>

            {course.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">{course.description}</p>
            )}

            {/* Progress indicator */}
            {progress && (
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">学习进度</span>
                  <span className="font-medium text-[#58CC02]">
                    {/* 如果测验通过或课程完成，显示100% */}
                    {isLearningComplete
                      ? 100
                      : Math.round(
                          ((progress.currentPage || 0) / (course.totalPages || 1)) * 100
                        )}
                    %
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#58CC02]"
                    initial={{ width: 0 }}
                    animate={{
                      width: isLearningComplete
                        ? '100%'
                        : `${((progress.currentPage || 0) / (course.totalPages || 1)) * 100}%`,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {/* Completion status */}
            {isLearningComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl"
              >
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    课程学习已完成！
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500">+50 XP</p>
                </div>
              </motion.div>
            )}

            {/* Quiz status */}
            {hasQuiz && (
              <div
                className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${
                  progress?.quizPassed
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-gray-50 dark:bg-gray-700'
                }`}
              >
                <span className="text-2xl">{progress?.quizPassed ? '🏆' : '📝'}</span>
                <div>
                  <p
                    className={`font-medium ${
                      progress?.quizPassed
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {progress?.quizPassed
                      ? `测验已通过 - ${progress.quizScore}分`
                      : '课后测验'}
                  </p>
                  <p
                    className={`text-sm ${
                      progress?.quizPassed
                        ? 'text-blue-600 dark:text-blue-500'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {progress?.quizPassed
                      ? '恭喜完成本课程全部内容'
                      : `及格分数: ${course.quiz?.pass_score || 60}分`}
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3 mt-6">
              {/* Learn / Continue button */}
              <motion.button
                onClick={handleStartLearning}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition ${
                  isLearningComplete
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    : 'bg-[#58CC02] text-white'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLearningComplete
                  ? '📖 再次学习'
                  : progress?.currentPage
                  ? '▶ 继续学习'
                  : '📖 开始学习'}
              </motion.button>

              {/* Quiz button */}
              {hasQuiz && (
                <motion.button
                  onClick={handleStartQuiz}
                  disabled={!isLearningComplete}
                  className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition ${
                    isLearningComplete
                      ? progress?.quizPassed
                        ? 'bg-blue-500 text-white'
                        : 'bg-[#1CB0F6] text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                  whileHover={isLearningComplete ? { scale: 1.02 } : {}}
                  whileTap={isLearningComplete ? { scale: 0.98 } : {}}
                >
                  {!isLearningComplete
                    ? '🔒 完成学习后解锁测验'
                    : progress?.quizPassed
                    ? '📝 重新测验'
                    : '📝 开始测验'}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
