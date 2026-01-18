import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSyllabusStore } from '../../stores/syllabusStore';
import type { Syllabus, CourseExtended } from '../../types';
import { getCourseIcon, lockIcon } from './CourseIcons';

interface SyllabusViewProps {
  syllabus: Syllabus;
  token: string;
  onBack: () => void;
  onSelectCourse: (course: CourseExtended) => void;
}

export function SyllabusView({ syllabus, token, onBack, onSelectCourse }: SyllabusViewProps) {
  const [courses, setCourses] = useState<CourseExtended[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    loadSyllabusCourses,
    getSyllabusProgress,
    isCourseUnlockedInSyllabus,
    getSyllabusCompletionPercentage,
  } = useSyllabusStore();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const coursesData = await loadSyllabusCourses(syllabus.id, token);
      const sorted = [...coursesData].sort(
        (a, b) => (a.order_in_syllabus || a.order || 0) - (b.order_in_syllabus || b.order || 0)
      );
      setCourses(sorted);
      setLoading(false);
    };
    load();
  }, [syllabus.id, token, loadSyllabusCourses]);

  const progress = getSyllabusProgress(syllabus.id);
  const completedCourses = progress?.completedCourses || [];
  const percentage = getSyllabusCompletionPercentage(syllabus.id);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  // Get position pattern for winding path (left, center, right, center, etc.)
  const getNodePosition = (index: number): 'left' | 'center' | 'right' => {
    const pattern = ['left', 'center', 'right', 'center'] as const;
    return pattern[index % 4];
  };

  const getPositionClass = (position: 'left' | 'center' | 'right') => {
    switch (position) {
      case 'left':
        return 'justify-start ml-8';
      case 'right':
        return 'justify-end mr-8';
      case 'center':
        return 'justify-center';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Compact Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {syllabus.name}
              </h1>
            </div>
            {/* Progress indicator */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1">
              <svg className="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                {completedCourses.length}/{courses.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="px-4 py-8 pb-24">
        <div className="max-w-md mx-auto space-y-8">
          {courses.map((course, index) => {
            const isCompleted = completedCourses.includes(course.id);
            const isUnlocked = isCourseUnlockedInSyllabus(syllabus.id, course.id);
            const isCurrent = isUnlocked && !isCompleted;
            const position = getNodePosition(index);

            // Calculate progress for this course (mock - can be replaced with actual progress)
            const courseProgress = isCompleted ? 100 : isCurrent ? 60 : 0;
            const circumference = 2 * Math.PI * 52; // radius = 52
            const strokeDashoffset = circumference - (courseProgress / 100) * circumference;

            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex ${getPositionClass(position)}`}
              >
                <button
                  onClick={() => isUnlocked && onSelectCourse(course)}
                  disabled={!isUnlocked}
                  className="group flex flex-col items-center"
                >
                  {/* Node with progress ring */}
                  <div className="relative">
                    {/* Progress ring background */}
                    <svg className="w-28 h-28 transform -rotate-90">
                      {/* Background ring */}
                      <circle
                        cx="56"
                        cy="56"
                        r="52"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-gray-300 dark:text-gray-600"
                      />
                      {/* Progress ring */}
                      {(isCompleted || isCurrent) && (
                        <motion.circle
                          cx="56"
                          cy="56"
                          r="52"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeLinecap="round"
                          className={isCompleted ? 'text-yellow-400' : 'text-green-500'}
                          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
                          animate={{ strokeDashoffset }}
                          transition={{ duration: 1, ease: 'easeOut', delay: index * 0.1 }}
                        />
                      )}
                    </svg>

                    {/* Main circle */}
                    <div
                      className={`
                        absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                        w-20 h-20 rounded-full flex items-center justify-center
                        transition-all duration-300
                        ${isCompleted
                          ? 'bg-green-500'
                          : isCurrent
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                        }
                        ${isUnlocked ? 'group-hover:scale-105 cursor-pointer' : 'cursor-not-allowed'}
                      `}
                    >
                      {/* Course icon - use course.icon or fallback to default */}
                      <div className={`w-10 h-10 ${!isUnlocked ? 'opacity-50' : ''}`}>
                        {isUnlocked ? getCourseIcon(course.icon) : lockIcon}
                      </div>
                    </div>

                    {/* Crown badge for completed or progress */}
                    {(isCompleted || isCurrent) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.1 + 0.3, type: 'spring' }}
                        className="absolute -bottom-1 right-2"
                      >
                        <div className="relative">
                          {/* Crown background */}
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center
                            ${isCompleted ? 'bg-yellow-400' : 'bg-yellow-400'}
                            shadow-lg
                          `}>
                            <svg className="w-5 h-5 text-yellow-800" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
                            </svg>
                          </div>
                          {/* Level number */}
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-yellow-500 rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                            <span className="text-[10px] font-bold text-yellow-900">
                              {isCompleted ? index + 1 : 1}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Pulse animation for current */}
                    {isCurrent && (
                      <motion.div
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-green-400"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    )}
                  </div>

                  {/* Course title - centered below */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                    className="mt-3 text-center"
                  >
                    <span className={`
                      text-sm font-semibold
                      ${isUnlocked
                        ? 'text-gray-800 dark:text-gray-200'
                        : 'text-gray-400 dark:text-gray-500'
                      }
                    `}>
                      {course.title}
                    </span>
                  </motion.div>
                </button>
              </motion.div>
            );
          })}
        </div>

        {courses.length === 0 && (
          <div className="text-center py-12">
            <span className="text-5xl mb-4 block">📚</span>
            <p className="text-gray-500 dark:text-gray-400">No courses in this syllabus yet</p>
          </div>
        )}
      </div>

      {/* Bottom stats bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-md mx-auto">
          {/* Overall progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Course Progress</span>
                <span>{percentage}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    percentage === 100 ? 'bg-yellow-400' : 'bg-green-500'
                  }`}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full px-3 py-1">
              <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
              <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                {completedCourses.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SyllabusView;
