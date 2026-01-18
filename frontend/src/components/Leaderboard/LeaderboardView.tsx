import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressStore } from '../../stores/progressStore';
import { useCourseStore } from '../../stores/courseStore';
import { useSyllabusStore } from '../../stores/syllabusStore';
import { fetchLeaderboard } from '../../services/sheetApi';
import type { LeaderboardResponse, LeaderboardEntry, GroupLeaderboard, Syllabus } from '../../types';

// Rank badge component
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center">
        <span className="text-yellow-900 font-bold">1</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
        <span className="text-gray-700 font-bold">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center">
        <span className="text-amber-100 font-bold">3</span>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
      <span className="text-gray-600 dark:text-gray-300 font-bold">{rank}</span>
    </div>
  );
}

// Leaderboard row component
function LeaderboardRow({
  entry,
  isCurrentUser,
  showSyllabusXP = false,
  index
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  showSyllabusXP?: boolean;
  index: number;
}) {
  return (
    <motion.div
      className={`flex items-center gap-4 p-4 ${
        isCurrentUser
          ? showSyllabusXP
            ? 'bg-purple-50 dark:bg-purple-900/20'
            : 'bg-green-50 dark:bg-green-900/20'
          : ''
      }`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <RankBadge rank={entry.rank} />

      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${
          isCurrentUser
            ? showSyllabusXP
              ? 'text-purple-600 dark:text-purple-400'
              : 'text-[#58CC02]'
            : 'text-gray-900 dark:text-white'
        }`}>
          {entry.username}
          {isCurrentUser && '（我）'}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          等级 {entry.level}
        </p>
      </div>

      <div className="text-right">
        {showSyllabusXP ? (
          <>
            <p className="font-bold text-purple-500">{entry.syllabusXP}</p>
            <p className="text-xs text-gray-400">课程表XP</p>
          </>
        ) : (
          <>
            <p className="font-bold text-blue-500">{entry.totalXP}</p>
            <p className="text-xs text-gray-400">XP</p>
          </>
        )}
      </div>
    </motion.div>
  );
}

// Group leaderboard card component
function GroupLeaderboardCard({
  group,
  currentUserId,
  defaultExpanded = false
}: {
  group: GroupLeaderboard;
  currentUserId?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Find current user's rank in this group
  const myRankInGroup = group.leaderboard.find(e => e.user_id === currentUserId)?.rank;

  // Group colors (cycle through)
  const colors = [
    'from-blue-400 to-blue-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-teal-400 to-teal-600',
    'from-orange-400 to-orange-600'
  ];
  const colorIndex = group.group_id.charCodeAt(group.group_id.length - 1) % colors.length;

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm mb-4 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Group header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-bold`}>
            {group.group_name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              {group.group_name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {group.leaderboard.length} 名成员
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {myRankInGroup && (
            <span className="text-[#58CC02] font-bold">#{myRankInGroup}</span>
          )}
          <motion.svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </div>

      {/* Expanded leaderboard */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {group.leaderboard.slice(0, 10).map((entry, index) => (
                <LeaderboardRow
                  key={entry.user_id}
                  entry={entry}
                  isCurrentUser={entry.user_id === currentUserId}
                  index={index}
                />
              ))}
            </div>

            {group.leaderboard.length > 10 && (
              <div className="p-3 text-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  还有 {group.leaderboard.length - 10} 人
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function LeaderboardView() {
  const [viewType, setViewType] = useState<'default' | 'syllabus'>('default');
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [syllabuses, setSyllabuses] = useState<Syllabus[]>([]);

  const { totalXP } = useProgressStore();
  const { surveyUserInfo } = useCourseStore();
  const { syllabi } = useSyllabusStore();
  const currentUserId = surveyUserInfo?.user_id;
  const currentUserLevel = Math.floor(totalXP / 100) + 1;

  // Load syllabuses for syllabus selector
  useEffect(() => {
    if (syllabi && syllabi.length > 0) {
      setSyllabuses(syllabi);
    }
  }, [syllabi]);

  // Load leaderboard
  const loadLeaderboard = async () => {
    setLoading(true);
    setError(false);
    try {
      if (viewType === 'syllabus' && selectedSyllabusId) {
        const data = await fetchLeaderboard({
          type: 'syllabus',
          syllabusId: selectedSyllabusId
        });
        setLeaderboardData(data);
      } else {
        const data = await fetchLeaderboard();
        setLeaderboardData(data);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [viewType, selectedSyllabusId]);

  // Current user's rank info from response
  const currentUserInfo = leaderboardData?.current_user;

  return (
    <div className="pt-20 pb-24 px-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
            <span className="text-3xl">🏆</span> 排行榜
          </h1>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
          <button
            onClick={() => setViewType('default')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${
              viewType === 'default'
                ? 'bg-white dark:bg-gray-700 text-[#58CC02] shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            我的排行
          </button>
          <button
            onClick={() => setViewType('syllabus')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${
              viewType === 'syllabus'
                ? 'bg-white dark:bg-gray-700 text-[#58CC02] shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            课程表排行
          </button>
        </div>

        {/* Current user rank card (for default view) */}
        {viewType === 'default' && currentUserInfo && currentUserInfo.rank && (
          <motion.div
            className="bg-gradient-to-r from-[#58CC02] to-[#4CAF50] rounded-2xl p-5 shadow-lg mb-6 text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">你的排名</p>
                <p className="text-3xl font-bold">#{currentUserInfo.rank}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">Lv.{currentUserInfo.level}</p>
                <p className="text-white/80">{currentUserInfo.totalXP} XP</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Syllabus selector (for syllabus view) */}
        {viewType === 'syllabus' && (
          <div className="mb-4">
            <select
              value={selectedSyllabusId || ''}
              onChange={(e) => setSelectedSyllabusId(e.target.value || null)}
              className="w-full p-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 font-medium text-gray-900 dark:text-white focus:border-[#58CC02] focus:ring-0 focus:outline-none transition-colors"
            >
              <option value="">选择课程表查看排行</option>
              {syllabuses.map(syllabus => (
                <option key={syllabus.id} value={syllabus.id}>
                  {syllabus.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Syllabus current user rank card */}
        {viewType === 'syllabus' && leaderboardData?.type === 'syllabus' && currentUserInfo && currentUserInfo.rank && (
          <motion.div
            className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-5 shadow-lg mb-6 text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">{leaderboardData.syllabus_name}</p>
                <p className="text-3xl font-bold">#{currentUserInfo.rank}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">Lv.{currentUserInfo.level}</p>
                <p className="text-white/80">{currentUserInfo.syllabusXP || 0} 课程表XP</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <motion.div
              className="w-12 h-12 border-4 border-[#58CC02] border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-gray-500 dark:text-gray-400 mt-4">加载中...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-gray-500 dark:text-gray-400 mb-4">加载失败</p>
            <motion.button
              onClick={loadLeaderboard}
              className="px-6 py-2 bg-[#58CC02] text-white rounded-xl font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              重试
            </motion.button>
          </motion.div>
        )}

        {/* Main content based on leaderboard type */}
        {!loading && !error && leaderboardData && (
          <>
            {/* Groups view (for guests in groups) */}
            {leaderboardData.type === 'groups' && leaderboardData.groups && (
              <div>
                {leaderboardData.groups.map((group, idx) => (
                  <GroupLeaderboardCard
                    key={group.group_id}
                    group={group}
                    currentUserId={currentUserId}
                    defaultExpanded={idx === 0}
                  />
                ))}
              </div>
            )}

            {/* Employees view */}
            {leaderboardData.type === 'employees' && leaderboardData.leaderboard && (
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="text-xl">👔</span>
                    员工排行榜
                  </h3>
                </div>

                {leaderboardData.leaderboard.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    暂无数据
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {leaderboardData.leaderboard.map((entry, index) => (
                      <LeaderboardRow
                        key={entry.user_id}
                        entry={entry}
                        isCurrentUser={entry.user_id === currentUserId}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Self only view (guest not in any group) */}
            {leaderboardData.type === 'self_only' && (
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="text-6xl mb-4">🦉</div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  还没有加入学习小组
                </h3>

                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  加入小组后可以和队友一起比拼学习进度
                </p>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 inline-block">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">我的成绩</p>
                  <p className="text-2xl font-bold text-[#58CC02]">Lv.{currentUserLevel}</p>
                  <p className="text-gray-600 dark:text-gray-300">{totalXP} XP</p>
                </div>
              </motion.div>
            )}

            {/* Syllabus view */}
            {leaderboardData.type === 'syllabus' && leaderboardData.leaderboard && (
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-pink-500">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <span className="text-xl">📚</span>
                    {leaderboardData.syllabus_name} 排行榜
                  </h3>
                  <p className="text-white/80 text-sm mt-1">仅统计该课程表内获得的 XP</p>
                </div>

                {leaderboardData.leaderboard.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    暂无数据
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {leaderboardData.leaderboard.map((entry, index) => (
                      <LeaderboardRow
                        key={entry.user_id}
                        entry={entry}
                        isCurrentUser={entry.user_id === currentUserId}
                        showSyllabusXP={true}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Prompt to select syllabus */}
            {viewType === 'syllabus' && !selectedSyllabusId && (
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  选择一个课程表
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  选择课程表后可以查看该课程表内的排名
                </p>
              </motion.div>
            )}
          </>
        )}

        {/* Not logged in message */}
        {!loading && !error && !leaderboardData && (
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-5xl mb-4">🔒</div>
            <p className="text-gray-500 dark:text-gray-400">请先登录查看排行榜</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
