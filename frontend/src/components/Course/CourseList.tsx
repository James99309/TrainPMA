import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useCourseStore } from '../../stores/courseStore';
import type { Course } from '../../types';

interface CourseListProps {
  onSelectCourse: (course: Course) => void;
}

export function CourseList({ onSelectCourse }: CourseListProps) {
  const { courses, loadCourses, getCourseProgress, isCourseUnlocked } = useCourseStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      await loadCourses();
      setLoading(false);
    };
    fetchCourses();
  }, [loadCourses]);

  const getCourseStatus = (course: Course) => {
    const progress = getCourseProgress(course.id);
    if (progress?.isCompleted) return 'completed';
    if (progress?.quizPassed) return 'quiz_passed';
    if (progress && progress.currentPage > 1) return 'in_progress';
    if (isCourseUnlocked(course.id)) return 'unlocked';
    return 'locked';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-[#58CC02] text-white';
      case 'quiz_passed':
        return 'bg-[#FF9600] text-white';
      case 'in_progress':
        return 'bg-[#1CB0F6] text-white ring-4 ring-blue-200';
      case 'unlocked':
        return 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-700';
      default:
        return 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return { text: '已完成', icon: '✓' };
      case 'quiz_passed':
        return { text: '测验通过', icon: '📝' };
      case 'in_progress':
        return { text: '继续学习', icon: '▶' };
      case 'unlocked':
        return { text: '可开始', icon: '📖' };
      default:
        return { text: '未解锁', icon: '🔒' };
    }
  };

  const getTypeIcon = (type: Course['type']) => {
    switch (type) {
      case 'pdf':
        return '📄';
      case 'ppt':
        return '📊';
      case 'text':
        return '📖';
      default:
        return '📚';
    }
  };

  const getProgressPercent = (course: Course) => {
    const progress = getCourseProgress(course.id);
    if (!progress || !course.totalPages) return 0;
    return Math.round((progress.currentPage / course.totalPages) * 100);
  };

  return (
    <div className="py-8 px-4">
      {/* Header */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📚 课程中心</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">选择课程开始学习</p>
      </motion.div>

      {/* Course grid */}
      {!loading && courses.length > 0 && (
      <div className="grid gap-4 max-w-lg mx-auto">
        {courses.map((course, index) => {
          const status = getCourseStatus(course);
          const isLocked = status === 'locked';
          const statusLabel = getStatusLabel(status);
          const progressPercent = getProgressPercent(course);

          return (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.button
                onClick={() => !isLocked && onSelectCourse(course)}
                disabled={isLocked}
                className={`w-full p-4 rounded-2xl shadow-lg transition-all ${getStatusColor(status)}`}
                whileHover={!isLocked ? { scale: 1.02, y: -2 } : {}}
                whileTap={!isLocked ? { scale: 0.98 } : {}}
              >
                <div className="flex items-start gap-4">
                  {/* Course icon */}
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl ${
                    isLocked ? 'bg-gray-300 dark:bg-gray-600' : 'bg-white/20'
                  }`}>
                    {isLocked ? '🔒' : getTypeIcon(course.type)}
                  </div>

                  {/* Course info */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide opacity-80">
                        {course.type.toUpperCase()}
                      </span>
                      {course.duration_minutes && (
                        <span className="text-xs opacity-60">
                          · {course.duration_minutes}分钟
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg mt-1">{course.title}</h3>
                    {course.description && (
                      <p className={`text-sm mt-1 ${isLocked ? 'opacity-50' : 'opacity-80'}`}>
                        {course.description}
                      </p>
                    )}

                    {/* Progress bar (for in-progress courses) */}
                    {status === 'in_progress' && progressPercent > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>学习进度</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-white rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Stars for completed courses */}
                    {status === 'completed' && (
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3].map((star) => (
                          <span key={star} className="text-yellow-300 text-lg">⭐</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isLocked ? 'bg-gray-300 dark:bg-gray-600' : 'bg-white/20'
                  }`}>
                    {statusLabel.icon} {statusLabel.text}
                  </div>
                </div>
              </motion.button>
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Loading state */}
      {loading && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-4">加载课程中...</p>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && courses.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="text-6xl">📚</span>
          <p className="text-gray-500 dark:text-gray-400 mt-4">暂无可用课程</p>
        </motion.div>
      )}
    </div>
  );
}
