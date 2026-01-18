import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWrongQuestionStore } from '../../stores/wrongQuestionStore';
import type { WrongQuestion } from '../../types';

interface WrongQuestionListProps {
  onStartPractice: (questions: WrongQuestion[]) => void;
}

type FilterType = 'all' | 'unresolved' | 'resolved';

export function WrongQuestionList({ onStartPractice }: WrongQuestionListProps) {
  const { wrongQuestions, markAsResolved, markAsUnresolved, removeQuestion, clearAllResolved } =
    useWrongQuestionStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 按课程分组
  const questionsByCourse = useMemo(() => {
    const grouped = new Map<string, WrongQuestion[]>();
    const filtered = wrongQuestions.filter((q) => {
      if (filter === 'unresolved') return !q.isResolved;
      if (filter === 'resolved') return q.isResolved;
      return true;
    });

    filtered.forEach((q) => {
      const key = q.courseName || '未分类';
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, q]);
    });

    return grouped;
  }, [wrongQuestions, filter]);

  // 统计数据
  const stats = useMemo(() => {
    const total = wrongQuestions.length;
    const unresolved = wrongQuestions.filter((q) => !q.isResolved).length;
    const resolved = wrongQuestions.filter((q) => q.isResolved).length;
    return { total, unresolved, resolved };
  }, [wrongQuestions]);

  const toggleCourse = (courseName: string) => {
    setExpandedCourses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(courseName)) {
        newSet.delete(courseName);
      } else {
        newSet.add(courseName);
      }
      return newSet;
    });
  };

  const handlePracticeAll = () => {
    const unresolvedQuestions = wrongQuestions.filter((q) => !q.isResolved);
    if (unresolvedQuestions.length > 0) {
      onStartPractice(unresolvedQuestions);
    }
  };

  const handlePracticeCourse = (courseName: string) => {
    const courseQuestions = questionsByCourse.get(courseName)?.filter((q) => !q.isResolved) || [];
    if (courseQuestions.length > 0) {
      onStartPractice(courseQuestions);
    }
  };

  const handlePracticeSingle = (question: WrongQuestion) => {
    onStartPractice([question]);
  };

  const handleClearResolved = () => {
    clearAllResolved();
    setShowClearConfirm(false);
  };

  // 空状态
  if (wrongQuestions.length === 0) {
    return (
      <div className="pt-20 pb-24 px-4 min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20">
          <span className="text-6xl mb-4">🎉</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            暂无错题
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center">
            继续加油学习吧！
            <br />
            测验中答错的题目会自动收录到这里
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-24 px-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        {/* 头部统计 */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📝 错题本
            </h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              共 {stats.total} 题
            </span>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">全部</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p className="text-xl font-bold text-red-500">{stats.unresolved}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">待掌握</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <p className="text-xl font-bold text-green-500">{stats.resolved}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">已掌握</p>
            </div>
          </div>

          {/* 筛选按钮 */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all', label: '全部' },
              { key: 'unresolved', label: '待掌握' },
              { key: 'resolved', label: '已掌握' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as FilterType)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-[#58CC02] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 练习全部按钮 */}
          {stats.unresolved > 0 && (
            <motion.button
              onClick={handlePracticeAll}
              className="w-full py-3 bg-[#58CC02] text-white font-bold rounded-xl flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              🔄 开始练习全部错题 ({stats.unresolved}题)
            </motion.button>
          )}

          {/* 清除已掌握按钮 */}
          {stats.resolved > 0 && (
            <motion.button
              onClick={() => setShowClearConfirm(true)}
              className="w-full mt-2 py-2 text-gray-500 dark:text-gray-400 text-sm"
              whileTap={{ scale: 0.98 }}
            >
              清除已掌握的题目
            </motion.button>
          )}
        </motion.div>

        {/* 按课程分组的错题列表 */}
        <div className="space-y-4">
          {Array.from(questionsByCourse.entries()).map(([courseName, questions]) => {
            const isExpanded = expandedCourses.has(courseName);
            const unresolvedCount = questions.filter((q) => !q.isResolved).length;

            return (
              <motion.div
                key={courseName}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* 课程标题 */}
                <div
                  onClick={() => toggleCourse(courseName)}
                  className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📚</span>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {courseName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {questions.length} 题 · {unresolvedCount} 题待掌握
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {unresolvedCount > 0 && (
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePracticeCourse(courseName);
                        }}
                        className="px-3 py-1 bg-[#58CC02] text-white text-sm font-medium rounded-lg"
                        whileTap={{ scale: 0.95 }}
                      >
                        练习
                      </motion.button>
                    )}
                    <span
                      className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      ▼
                    </span>
                  </div>
                </div>

                {/* 展开的题目列表 */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <div className="p-4 space-y-3">
                        {questions.map((question) => (
                          <WrongQuestionItem
                            key={question.id}
                            question={question}
                            onPractice={() => handlePracticeSingle(question)}
                            onMarkResolved={() => markAsResolved(question.id)}
                            onMarkUnresolved={() => markAsUnresolved(question.id)}
                            onRemove={() => removeQuestion(question.id)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* 清除确认弹窗 */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
            >
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  确认清除
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  确定要清除所有已掌握的题目吗？此操作不可撤销。
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleClearResolved}
                    className="flex-1 py-2 bg-red-500 text-white font-medium rounded-xl"
                  >
                    确认清除
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// 单个错题项组件
interface WrongQuestionItemProps {
  question: WrongQuestion;
  onPractice: () => void;
  onMarkResolved: () => void;
  onMarkUnresolved: () => void;
  onRemove: () => void;
}

function WrongQuestionItem({
  question,
  onPractice,
  onMarkResolved,
  onMarkUnresolved,
  onRemove,
}: WrongQuestionItemProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      className={`p-4 rounded-xl border-2 ${
        question.isResolved
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
      }`}
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">
          {question.isResolved ? '✅' : '❌'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">
            {question.questionText}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
              {question.questionType === 'single_choice'
                ? '单选'
                : question.questionType === 'multiple_choice'
                ? '多选'
                : '填空'}
            </span>
            <span>错{question.wrongCount}次</span>
            {question.score && <span>{question.score}分</span>}
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2"
          >
            {!question.isResolved && (
              <button
                onClick={onPractice}
                className="flex-1 py-2 bg-[#58CC02] text-white text-sm font-medium rounded-lg"
              >
                重做
              </button>
            )}
            {question.isResolved ? (
              <button
                onClick={onMarkUnresolved}
                className="flex-1 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg"
              >
                标记未掌握
              </button>
            ) : (
              <button
                onClick={onMarkResolved}
                className="flex-1 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg"
              >
                标记已掌握
              </button>
            )}
            <button
              onClick={onRemove}
              className="py-2 px-4 bg-red-100 dark:bg-red-900/30 text-red-500 text-sm font-medium rounded-lg"
            >
              删除
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
