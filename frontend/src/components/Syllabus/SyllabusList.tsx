import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSyllabusStore } from '../../stores/syllabusStore';
import type { Syllabus } from '../../types';

interface SyllabusListProps {
  token: string;
  onSelectSyllabus: (syllabus: Syllabus) => void;
}

export function SyllabusList({ token, onSelectSyllabus }: SyllabusListProps) {
  const { syllabi, loading, error, loadAccessibleSyllabi, getSyllabusProgress, getSyllabusCompletionPercentage, loadSyllabusCourses } = useSyllabusStore();

  useEffect(() => {
    loadAccessibleSyllabi(token);
  }, [token, loadAccessibleSyllabi]);

  // Preload courses for progress calculation
  useEffect(() => {
    syllabi.forEach((syllabus) => {
      loadSyllabusCourses(syllabus.id, token);
    });
  }, [syllabi, token, loadSyllabusCourses]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-screen bg-slate-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-200 dark:border-indigo-900"></div>
            <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-500 dark:text-gray-400">Loading your learning path...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 min-h-screen bg-slate-50 dark:bg-gray-900">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 max-w-sm mx-auto">
          <span className="text-4xl block mb-3">😔</span>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (syllabi.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-screen bg-slate-50 dark:bg-gray-900 px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">📚</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No Programs Yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs">
            Check back soon for exciting new learning adventures!
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Learning Path
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Choose a program to start your journey
        </p>
      </motion.div>

      {/* Syllabus cards */}
      <div className="space-y-4">
        {syllabi.map((syllabus, index) => {
          const progress = getSyllabusProgress(syllabus.id);
          const completedCount = progress?.completedCourses.length || 0;
          const totalCount = syllabus.course_sequence.length;
          const percentage = getSyllabusCompletionPercentage(syllabus.id);

          // Determine status
          const isNotStarted = completedCount === 0;
          const isCompleted = percentage === 100 && totalCount > 0;
          const isInProgress = !isNotStarted && !isCompleted;

          // Check time config
          const isTimeLimited = syllabus.time_config.type === 'limited';
          const startDate = syllabus.time_config.start_date ? new Date(syllabus.time_config.start_date) : null;
          const endDate = syllabus.time_config.end_date ? new Date(syllabus.time_config.end_date) : null;
          const now = new Date();
          const isNotYetStarted = !!(startDate && now < startDate);
          const isExpired = !!(endDate && now > endDate);
          const isAvailable = !isNotYetStarted && !isExpired;

          // Calculate days remaining
          const daysRemaining = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

          return (
            <motion.button
              key={syllabus.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => isAvailable && onSelectSyllabus(syllabus)}
              disabled={!isAvailable}
              className={`
                w-full bg-white dark:bg-gray-800 rounded-2xl p-4
                flex items-center gap-4 text-left
                transition-all duration-200
                ${isAvailable
                  ? 'shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer'
                  : 'opacity-60 cursor-not-allowed'
                }
              `}
            >
              {/* Circular progress indicator */}
              <div className="relative flex-shrink-0">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-gray-100 dark:text-gray-700"
                  />
                  <motion.circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    className={
                      isCompleted
                        ? 'text-emerald-500'
                        : isInProgress
                        ? 'text-indigo-500'
                        : 'text-gray-300 dark:text-gray-600'
                    }
                    initial={{ strokeDasharray: '0 176' }}
                    animate={{ strokeDasharray: `${percentage * 1.76} 176` }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.2 }}
                  />
                </svg>
                {/* Center content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {isCompleted ? (
                    <svg className="w-7 h-7 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                    </svg>
                  ) : isInProgress ? (
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {percentage}%
                    </span>
                  ) : isNotYetStarted ? (
                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : isExpired ? (
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg leading-tight">
                    {syllabus.name}
                  </h3>
                  {/* Status badge */}
                  {isCompleted && (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">
                      Done
                    </span>
                  )}
                  {isInProgress && (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-full">
                      Active
                    </span>
                  )}
                  {isNotYetStarted && (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-full">
                      Soon
                    </span>
                  )}
                  {isExpired && (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium rounded-full">
                      Ended
                    </span>
                  )}
                </div>

                {/* Description */}
                {syllabus.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                    {syllabus.description}
                  </p>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-4 mt-2">
                  {/* Course count with icons */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                      {[...Array(Math.min(totalCount, 3))].map((_, i) => (
                        <div
                          key={i}
                          className={`w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
                            i < completedCount
                              ? 'bg-emerald-400'
                              : 'bg-gray-200 dark:bg-gray-600'
                          }`}
                        />
                      ))}
                      {totalCount > 3 && (
                        <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400">
                            +{totalCount - 3}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {completedCount}/{totalCount}
                    </span>
                  </div>

                  {/* Time info */}
                  {isTimeLimited && isAvailable && daysRemaining !== null && daysRemaining > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{daysRemaining}d left</span>
                    </div>
                  )}

                  {isNotYetStarted && startDate && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Starts {startDate.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow indicator */}
              {isAvailable && (
                <div className="flex-shrink-0">
                  <svg
                    className={`w-5 h-5 ${
                      isCompleted
                        ? 'text-emerald-400'
                        : isInProgress
                        ? 'text-indigo-400'
                        : 'text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Bottom encouragement */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: syllabi.length * 0.1 + 0.3 }}
        className="mt-8 text-center"
      >
        <p className="text-sm text-gray-400 dark:text-gray-500">
          🎯 Complete all courses to earn your certificate!
        </p>
      </motion.div>
    </div>
  );
}

export default SyllabusList;
