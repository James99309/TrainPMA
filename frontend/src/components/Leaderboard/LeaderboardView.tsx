import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '../../stores/progressStore';
import { fetchLeaderboard } from '../../services/sheetApi';
import type { LeaderboardEntry } from '../../types';

export function LeaderboardView() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const { username, totalXP } = useProgressStore();
  const currentUserLevel = Math.floor(totalXP / 100) + 1;

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchLeaderboard();
      setLeaderboard(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  // Find current user's rank
  const currentUserRank = leaderboard.find(
    (entry) => entry.username === username
  );

  const getRankIcon = (rank: number) => {
    if (rank === 1) return { icon: '1', bg: 'bg-yellow-400', text: 'text-yellow-900' };
    if (rank === 2) return { icon: '2', bg: 'bg-gray-300', text: 'text-gray-700' };
    if (rank === 3) return { icon: '3', bg: 'bg-amber-600', text: 'text-amber-100' };
    return { icon: String(rank), bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' };
  };

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
            <span className="text-3xl">🏆</span> Leaderboard
          </h1>
        </motion.div>

        {/* Current user rank card */}
        {currentUserRank && (
          <motion.div
            className="bg-gradient-to-r from-[#58CC02] to-[#4CAF50] rounded-2xl p-5 shadow-lg mb-6 text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Your Rank</p>
                <p className="text-3xl font-bold">#{currentUserRank.rank}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">Lv.{currentUserRank.level}</p>
                <p className="text-white/80">{currentUserRank.totalXP} XP</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Not ranked yet */}
        {!currentUserRank && !loading && !error && (
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm mb-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-gray-500 dark:text-gray-400">Keep learning to appear on the leaderboard!</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Current: Lv.{currentUserLevel} · {totalXP} XP
            </p>
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
            <p className="text-gray-500 dark:text-gray-400 mt-4">Loading leaderboard...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-gray-500 dark:text-gray-400 mb-4">Failed to load leaderboard</p>
            <motion.button
              onClick={loadLeaderboard}
              className="px-6 py-2 bg-[#58CC02] text-white rounded-xl font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Retry
            </motion.button>
          </motion.div>
        )}

        {/* Leaderboard list */}
        {!loading && !error && (
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No data available yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = entry.username === username;
                  const rankStyle = getRankIcon(entry.rank);

                  return (
                    <motion.div
                      key={entry.username}
                      className={`flex items-center gap-4 p-4 ${
                        isCurrentUser ? 'bg-green-50' : ''
                      }`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {/* Rank badge */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${rankStyle.bg} ${rankStyle.text}`}
                      >
                        {rankStyle.icon}
                      </div>

                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${
                          isCurrentUser ? 'text-[#58CC02]' : 'text-gray-900 dark:text-white'
                        }`}>
                          {entry.username}
                          {isCurrentUser && ' (You)'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Level {entry.level}
                        </p>
                      </div>

                      {/* XP */}
                      <div className="text-right">
                        <p className="font-bold text-blue-500">{entry.totalXP}</p>
                        <p className="text-xs text-gray-400">XP</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
