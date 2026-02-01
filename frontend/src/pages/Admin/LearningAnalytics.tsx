import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import adminApi from '../../services/adminApi';

interface SyllabusTab {
  id: string;
  name: string;
}

interface OverviewRow {
  user_id: string;
  name: string;
  company: string;
  completed_courses: number;
  completed_course_names: string[];
  total_courses: number;
  avg_score: number;
  avg_max_score: number;
}

interface CourseScore {
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
}

interface SyllabusRow {
  user_id: string;
  name: string;
  company: string;
  course_scores: Record<string, CourseScore | null>;
  passed_count: number;
  total_count: number;
}

interface CourseInfo {
  course_id: string;
  title: string;
  pass_score: number;
}

interface OverviewData {
  view: 'overview';
  total_courses: number;
  rows: OverviewRow[];
}

interface SyllabusData {
  view: 'syllabus';
  syllabus: { id: string; name: string };
  courses: CourseInfo[];
  rows: SyllabusRow[];
}

export function LearningAnalytics() {
  const [syllabiTabs, setSyllabiTabs] = useState<SyllabusTab[]>([]);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | SyllabusData | null>(null);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState('');

  // Load syllabi tabs on mount
  useEffect(() => {
    const loadSyllabi = async () => {
      try {
        const syllabi = await adminApi.getAnalyticsSyllabi();
        setSyllabiTabs(syllabi);
      } catch (err) {
        console.error('Failed to load syllabi:', err);
      }
    };
    loadSyllabi();
  }, []);

  // Load data when tab changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const syllabusId = activeTab === 'overview' ? undefined : activeTab;
        const result = await adminApi.getLearningAnalytics(syllabusId);
        setData(result);
      } catch (err: any) {
        setError(err.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab]);

  // Filter rows by search text
  const filteredRows = useMemo(() => {
    if (!data) return [];
    const rows = data.rows as any[];
    if (!searchText.trim()) return rows;
    const lower = searchText.toLowerCase();
    return rows.filter(
      (r: any) =>
        r.name.toLowerCase().includes(lower) ||
        (r.company && r.company.toLowerCase().includes(lower))
    );
  }, [data, searchText]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          学习成绩
        </h2>
      </div>

      {/* Syllabus Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">课程表:</span>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          全部概览
        </button>
        {syllabiTabs.map((syl) => (
          <button
            key={syl.id}
            onClick={() => setActiveTab(syl.id)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              activeTab === syl.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {syl.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索用户名或公司..."
          className="w-full max-w-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
        />
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg"
        >
          {error}
        </motion.div>
      )}

      {/* Loading overlay for tab switches */}
      {loading && data && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* Table */}
      {!loading && data && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          {filteredRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {searchText ? '未找到匹配的用户' : '暂无学习数据'}
            </div>
          ) : data.view === 'overview' ? (
            <OverviewTable rows={filteredRows as OverviewRow[]} />
          ) : (
            <SyllabusTable
              courses={(data as SyllabusData).courses}
              rows={filteredRows as SyllabusRow[]}
            />
          )}
        </div>
      )}
    </div>
  );
}

// === Overview Table ===
function OverviewTable({ rows }: { rows: OverviewRow[] }) {
  return (
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead className="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            用户名
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            公司
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            已完成课程
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            总得分
          </th>
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {rows.map((row) => (
          <motion.tr
            key={row.user_id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
              {row.name}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
              {row.company || '-'}
            </td>
            <td className="px-6 py-4 text-sm">
              {row.completed_course_names.length > 0
                ? row.completed_course_names.map((name) => (
                    <span
                      key={name}
                      className="inline-block px-2 py-0.5 mr-1 mb-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full"
                    >
                      {name}
                    </span>
                  ))
                : <span className="text-gray-400">-</span>
              }
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-mono text-gray-900 dark:text-white">
              {row.avg_max_score > 0
                ? `${row.avg_score}/${row.avg_max_score}`
                : '-'}
            </td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  );
}

// === Syllabus Detail Table ===
function SyllabusTable({
  courses,
  rows,
}: {
  courses: CourseInfo[];
  rows: SyllabusRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
              用户名
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              公司
            </th>
            {courses.map((course) => (
              <th
                key={course.course_id}
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[120px]"
              >
                {course.title}
              </th>
            ))}
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              完成度
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row) => (
            <motion.tr
              key={row.user_id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10">
                {row.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {row.company || '-'}
              </td>
              {courses.map((course) => {
                const scoreData = row.course_scores[course.course_id];
                if (!scoreData) {
                  return (
                    <td
                      key={course.course_id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400"
                    >
                      -
                    </td>
                  );
                }
                return (
                  <td
                    key={course.course_id}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-center font-mono font-medium ${
                      scoreData.passed
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {scoreData.score}/{scoreData.max_score}
                  </td>
                );
              })}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                <span
                  className={`font-semibold ${
                    row.passed_count === row.total_count && row.total_count > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {row.passed_count}/{row.total_count}
                </span>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LearningAnalytics;
