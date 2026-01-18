import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProgress, ReadingSession } from '../types';
import { debouncedSaveProgress, cancelPendingSync, forceImmediateSync } from '../services/progressApi';
import { useWrongQuestionStore } from './wrongQuestionStore';

interface ProgressState extends UserProgress {
  session: ReadingSession | null;
  username: string | null;
  lastHeartLoss: number | null; // timestamp when hearts were last lost
  darkMode: boolean;
  isSyncing: boolean; // sync status

  // Actions
  startSession: (chapterId: number, sectionId: number) => void;
  endSession: () => void;
  addXP: (amount: number) => void;
  loseHeart: () => void;
  restoreHeart: () => void;
  checkAndRestoreHearts: () => void; // Check time-based restoration
  exchangeXPForHeart: () => boolean; // Exchange 100 XP for 1 heart
  completeChapter: (chapterId: number) => void;
  setCurrentPosition: (chapterId: number, sectionId: number) => void;
  updateStreak: () => void;
  unlockAchievement: (achievementId: string) => void;
  setDailyGoal: (minutes: number) => void;
  completeOnboarding: () => void;
  addLearnedWord: (word: string) => void;
  resetProgress: () => void;
  setUsername: (name: string) => void;
  logout: () => void;
  toggleDarkMode: () => void;

  // 培训系统新增 Actions
  completeCourse: (courseId: string, totalCourses?: number) => void;
  recordQuizPass: (isPerfect: boolean) => void;
  recordQuizFail: () => void;

  // XP 奖励系统 Actions
  claimDailyLoginReward: () => { earned: boolean; xp: number; streakBonus: number };
  claimFirstLoginReward: () => { earned: boolean; xp: number };
  recordFirstQuizPass: (surveyId: string) => boolean;  // 返回是否是首次
  getAchievementXP: (achievementId: string) => number;

  // 课程表 XP Actions
  xpBySyllabus: Record<string, number>;
  addSyllabusXP: (syllabusId: string, xp: number) => void;

  // Sync Actions
  loadFromServer: (serverProgress: UserProgress) => void;
  getProgressData: () => UserProgress;
  triggerSync: () => void;
}

const initialState: UserProgress = {
  streak: 0,
  lastReadDate: null,
  totalXP: 0,
  hearts: 5,
  maxHearts: 5,
  dailyGoalMinutes: 10,
  currentChapter: 1,
  currentSection: 0,
  chaptersCompleted: [],
  achievements: [],
  wordsLearned: [],
  onboardingCompleted: false,
  totalReadingTime: 0,
  // 培训系统新增字段
  coursesCompleted: [],
  quizzesPassed: 0,
  quizStreak: 0,
  // XP 奖励系统字段
  lastLoginRewardDate: null,
  firstPassedQuizzes: [],
  firstLoginRewardClaimed: false,
  // 课程表 XP 统计
  xpBySyllabus: {},
};

// 成就XP奖励映射
const ACHIEVEMENT_XP: Record<string, number> = {
  'first_course': 30,
  'first_quiz': 20,
  'perfect_quiz': 50,
  'streak_3': 30,
  'streak_7': 50,
  'streak_30': 100,
  'course_3': 40,
  'course_5': 60,
  'course_all': 100,
  'quiz_5': 40,
  'quiz_streak_3': 30,
  'xp_100': 20,
  'xp_500': 50,
  'xp_1000': 100,
  'first_chapter': 30,
  'word_master_10': 20,
  'word_master_50': 50,
};

// 每日登录奖励
const DAILY_LOGIN_XP = 20;
// 首次登录奖励
const FIRST_LOGIN_XP = 200;
// 连续学习加成系数
const STREAK_BONUS_MULTIPLIER = 5;

// Heart regeneration: 30 minutes per heart
const HEART_REGEN_INTERVAL = 30 * 60 * 1000; // 30 minutes in ms
const XP_PER_HEART = 100;

// Helper to get progress data for sync
const extractProgressData = (state: ProgressState): UserProgress => ({
  streak: state.streak,
  lastReadDate: state.lastReadDate,
  totalXP: state.totalXP,
  hearts: state.hearts,
  maxHearts: state.maxHearts,
  dailyGoalMinutes: state.dailyGoalMinutes,
  currentChapter: state.currentChapter,
  currentSection: state.currentSection,
  chaptersCompleted: state.chaptersCompleted,
  achievements: state.achievements,
  wordsLearned: state.wordsLearned,
  onboardingCompleted: state.onboardingCompleted,
  totalReadingTime: state.totalReadingTime,
  // 培训系统新增字段
  coursesCompleted: state.coursesCompleted,
  quizzesPassed: state.quizzesPassed,
  quizStreak: state.quizStreak,
  // XP 奖励系统字段
  lastLoginRewardDate: state.lastLoginRewardDate,
  firstPassedQuizzes: state.firstPassedQuizzes,
  firstLoginRewardClaimed: state.firstLoginRewardClaimed,
  // 错题记录 (从 wrongQuestionStore 获取)
  wrongQuestions: useWrongQuestionStore.getState().wrongQuestions,
  // 课程表 XP 统计
  xpBySyllabus: state.xpBySyllabus,
});

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initialState,
      session: null,
      username: null,
      lastHeartLoss: null,
      darkMode: false,
      isSyncing: false,

      startSession: (chapterId, sectionId) => {
        set({
          session: {
            startTime: Date.now(),
            currentChapter: chapterId,
            currentSection: sectionId,
            xpEarned: 0,
            wordsViewed: [],
          },
        });
      },

      endSession: () => {
        const { session } = get();
        if (session) {
          const readingTimeSeconds = Math.floor((Date.now() - session.startTime) / 1000);
          set((state) => ({
            session: null,
            totalReadingTime: state.totalReadingTime + readingTimeSeconds,
          }));
        }
      },

      addXP: (amount) => {
        const { unlockAchievement } = get();
        set((state) => {
          const newXP = state.totalXP + amount;

          // 检查 XP 成就
          if (newXP >= 100) unlockAchievement('xp_100');
          if (newXP >= 500) unlockAchievement('xp_500');
          if (newXP >= 1000) unlockAchievement('xp_1000');

          return {
            totalXP: newXP,
            session: state.session
              ? { ...state.session, xpEarned: state.session.xpEarned + amount }
              : null,
          };
        });
      },

      loseHeart: () => {
        set((state) => ({
          hearts: Math.max(0, state.hearts - 1),
          lastHeartLoss: state.hearts > 0 ? Date.now() : state.lastHeartLoss,
        }));
      },

      restoreHeart: () => {
        set((state) => ({
          hearts: Math.min(state.maxHearts, state.hearts + 1),
        }));
      },

      checkAndRestoreHearts: () => {
        const { hearts, maxHearts, lastHeartLoss } = get();
        if (hearts >= maxHearts || !lastHeartLoss) return;

        const now = Date.now();
        const elapsed = now - lastHeartLoss;
        const heartsToRestore = Math.floor(elapsed / HEART_REGEN_INTERVAL);

        if (heartsToRestore > 0) {
          const newHearts = Math.min(maxHearts, hearts + heartsToRestore);
          set({
            hearts: newHearts,
            lastHeartLoss: newHearts >= maxHearts ? null : now,
          });
        }
      },

      exchangeXPForHeart: () => {
        const { totalXP, hearts, maxHearts } = get();
        if (totalXP < XP_PER_HEART || hearts >= maxHearts) {
          return false;
        }
        set({
          totalXP: totalXP - XP_PER_HEART,
          hearts: hearts + 1,
        });
        return true;
      },

      completeChapter: (chapterId) => {
        const { chaptersCompleted, unlockAchievement } = get();
        const isNewChapter = !chaptersCompleted.includes(chapterId);

        set((state) => ({
          chaptersCompleted: isNewChapter
            ? [...state.chaptersCompleted, chapterId]
            : state.chaptersCompleted,
          // Restore 1 heart when completing a chapter
          hearts: Math.min(state.maxHearts, state.hearts + 1),
        }));

        // Achievement: Complete Chapter 1
        if (isNewChapter && chapterId === 1) {
          unlockAchievement('first_chapter');
        }
      },

      setCurrentPosition: (chapterId, sectionId) => {
        set({
          currentChapter: chapterId,
          currentSection: sectionId,
        });
      },

      updateStreak: () => {
        const today = new Date().toDateString();
        const { lastReadDate, streak, unlockAchievement } = get();

        if (lastReadDate === today) {
          return; // Already updated today
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        let newStreak: number;
        if (lastReadDate === yesterdayStr) {
          // Consecutive day
          newStreak = streak + 1;
        } else {
          // Streak broken or first day
          newStreak = 1;
        }

        set({ streak: newStreak, lastReadDate: today });

        // Achievements: Streak milestones (培训系统成就)
        if (newStreak >= 3) {
          unlockAchievement('streak_3');
        }
        if (newStreak >= 7) {
          unlockAchievement('streak_7');
        }
        if (newStreak >= 30) {
          unlockAchievement('streak_30');
        }
      },

      unlockAchievement: (achievementId) => {
        const { achievements } = get();
        if (achievements.includes(achievementId)) {
          return; // 已解锁，不重复奖励
        }

        // 发放成就XP奖励
        const xpReward = ACHIEVEMENT_XP[achievementId] || 20;

        set((state) => ({
          achievements: [...state.achievements, achievementId],
        }));

        // 成就XP不通过addXP发放，避免循环触发XP成就检查
        set((state) => ({
          totalXP: state.totalXP + xpReward,
        }));

        console.log(`[Achievement] 解锁成就 ${achievementId}, 奖励 ${xpReward} XP`);
      },

      setDailyGoal: (minutes) => {
        set({ dailyGoalMinutes: minutes });
      },

      completeOnboarding: () => {
        set({ onboardingCompleted: true });
      },

      addLearnedWord: (word) => {
        const { wordsLearned, unlockAchievement } = get();
        if (wordsLearned.includes(word)) return;

        const newCount = wordsLearned.length + 1;
        set((state) => ({
          wordsLearned: [...state.wordsLearned, word],
        }));

        // Achievements: Word milestones
        if (newCount >= 10) {
          unlockAchievement('word_master_10');
        }
        if (newCount >= 50) {
          unlockAchievement('word_master_50');
        }
      },

      resetProgress: () => {
        set({ ...initialState, session: null, username: null, lastHeartLoss: null, darkMode: false, isSyncing: false });
      },

      setUsername: (name) => {
        set({ username: name });
      },

      logout: () => {
        // Clear zustand persist localStorage data to prevent data pollution between users
        localStorage.removeItem('stargirl-progress');
        set({ ...initialState, session: null, username: null, lastHeartLoss: null });
      },

      toggleDarkMode: () => {
        set((state) => ({ darkMode: !state.darkMode }));
      },

      // 培训系统新增 Actions
      completeCourse: (courseId, totalCourses) => {
        const { coursesCompleted, unlockAchievement } = get();
        if (coursesCompleted.includes(courseId)) return;

        const newCoursesCompleted = [...coursesCompleted, courseId];
        const completedCount = newCoursesCompleted.length;

        set({ coursesCompleted: newCoursesCompleted });

        // 检查课程完成成就
        if (completedCount >= 1) {
          unlockAchievement('first_course');
        }
        if (completedCount >= 3) {
          unlockAchievement('course_3');
        }
        if (completedCount >= 5) {
          unlockAchievement('course_5');
        }
        // 如果提供了总课程数，检查是否完成所有课程
        if (totalCourses && completedCount >= totalCourses) {
          unlockAchievement('course_all');
        }
      },

      recordQuizPass: (isPerfect) => {
        const { quizzesPassed, quizStreak, unlockAchievement } = get();

        const newQuizzesPassed = quizzesPassed + 1;
        const newQuizStreak = quizStreak + 1;

        set({
          quizzesPassed: newQuizzesPassed,
          quizStreak: newQuizStreak,
        });

        // 检查测验成就
        // 首次测验通过
        if (newQuizzesPassed === 1) {
          unlockAchievement('first_quiz');
        }

        // 满分成就
        if (isPerfect) {
          unlockAchievement('perfect_quiz');
        }

        // 通过5次测验
        if (newQuizzesPassed >= 5) {
          unlockAchievement('quiz_5');
        }

        // 连续3次通过
        if (newQuizStreak >= 3) {
          unlockAchievement('quiz_streak_3');
        }
      },

      recordQuizFail: () => {
        // 重置测验连续通过次数
        set({ quizStreak: 0 });
      },

      // XP 奖励系统 Actions
      claimDailyLoginReward: () => {
        const today = new Date().toDateString();
        const { lastLoginRewardDate, addXP } = get();

        if (lastLoginRewardDate === today) {
          // 今天已经领取过了
          return { earned: false, xp: 0, streakBonus: 0 };
        }

        // 更新连续学习天数
        get().updateStreak();

        // 领取每日登录奖励
        const xp = DAILY_LOGIN_XP;
        const currentStreak = get().streak;
        const streakBonus = currentStreak > 1 ? STREAK_BONUS_MULTIPLIER * currentStreak : 0;

        addXP(xp);
        if (streakBonus > 0) {
          addXP(streakBonus);
        }

        set({ lastLoginRewardDate: today });

        console.log(`[DailyLogin] 每日登录奖励 +${xp} XP, 连续学习加成 +${streakBonus} XP (连续 ${currentStreak} 天)`);

        return { earned: true, xp, streakBonus };
      },

      claimFirstLoginReward: () => {
        const { firstLoginRewardClaimed, addXP } = get();

        if (firstLoginRewardClaimed) {
          return { earned: false, xp: 0 };
        }

        const xp = FIRST_LOGIN_XP;
        addXP(xp);
        set({ firstLoginRewardClaimed: true });

        console.log(`[FirstLogin] 首次登录奖励 +${xp} XP`);

        return { earned: true, xp };
      },

      recordFirstQuizPass: (surveyId: string) => {
        const { firstPassedQuizzes } = get();

        if (firstPassedQuizzes.includes(surveyId)) {
          // 已经首次通过过了
          return false;
        }

        set((state) => ({
          firstPassedQuizzes: [...state.firstPassedQuizzes, surveyId],
        }));

        console.log(`[FirstQuizPass] 测验 ${surveyId} 首次通过`);
        return true;
      },

      getAchievementXP: (achievementId: string) => {
        return ACHIEVEMENT_XP[achievementId] || 20;
      },

      // 课程表 XP Actions
      xpBySyllabus: {},

      addSyllabusXP: (syllabusId: string, xp: number) => {
        set((state) => ({
          xpBySyllabus: {
            ...state.xpBySyllabus,
            [syllabusId]: (state.xpBySyllabus[syllabusId] || 0) + xp
          }
          // 注意: 不增加 totalXP，因为课程表 XP 与账户总 XP 独立
        }));
        console.log(`[SyllabusXP] 课程表 ${syllabusId} 增加 ${xp} XP`);
      },

      // Load progress from server (used on login)
      loadFromServer: (serverProgress: UserProgress) => {
        console.log('[ProgressSync] ========== LOAD FROM SERVER DEBUG ==========');
        console.log('[ProgressSync] Current local state BEFORE load:', {
          hearts: get().hearts,
          totalXP: get().totalXP,
          streak: get().streak,
        });
        console.log('[ProgressSync] Server progress to load:', {
          hearts: serverProgress.hearts,
          totalXP: serverProgress.totalXP,
          streak: serverProgress.streak,
          chaptersCompleted: serverProgress.chaptersCompleted,
          currentChapter: serverProgress.currentChapter,
          currentSection: serverProgress.currentSection,
          wrongQuestions: serverProgress.wrongQuestions?.length || 0,
        });
        set({
          ...serverProgress,
          // 确保 firstLoginRewardClaimed 有明确的值，不依赖 localStorage 残留
          firstLoginRewardClaimed: serverProgress.firstLoginRewardClaimed ?? false,
          // 确保 xpBySyllabus 有明确的值
          xpBySyllabus: serverProgress.xpBySyllabus ?? {},
          // Preserve local-only state
          session: get().session,
          username: get().username,
          lastHeartLoss: get().lastHeartLoss,
          darkMode: get().darkMode,
          isSyncing: false,
        });

        // Load wrong questions into wrongQuestionStore
        if (serverProgress.wrongQuestions && serverProgress.wrongQuestions.length > 0) {
          useWrongQuestionStore.getState().loadFromServer(serverProgress.wrongQuestions);
          console.log('[ProgressSync] ✅ Loaded', serverProgress.wrongQuestions.length, 'wrong questions from server');
        }

        console.log('[ProgressSync] State AFTER load:', {
          hearts: get().hearts,
          totalXP: get().totalXP,
          streak: get().streak,
        });
        console.log('[ProgressSync] ✅ Progress loaded from server');
        console.log('[ProgressSync] ========== LOAD FROM SERVER DEBUG END ==========');
      },

      // Get current progress data for sync
      getProgressData: () => {
        return extractProgressData(get());
      },

      // Trigger sync to server (debounced)
      triggerSync: () => {
        const progress = extractProgressData(get());
        debouncedSaveProgress(progress);
      },
    }),
    {
      name: 'stargirl-progress',
      // Custom partialize to exclude session state from persistence
      partialize: (state) => ({
        ...extractProgressData(state),
        username: state.username,
        lastHeartLoss: state.lastHeartLoss,
        darkMode: state.darkMode,
      }),
      // Add onRehydrateStorage to handle sync after rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('[ProgressSync] Store rehydrated from localStorage:', {
            username: state.username,
            totalXP: state.totalXP,
            streak: state.streak,
            chaptersCompleted: state.chaptersCompleted?.length || 0,
          });
        }
      },
    }
  )
);

// Subscribe to state changes and trigger auto-sync
// Only sync when user is logged in
useProgressStore.subscribe((state, prevState) => {
  // Only sync if user is logged in and progress data changed
  if (!state.username) {
    // Don't log this - it would be too noisy for guests
    return;
  }

  // Check if progress data changed (not just local state)
  const currentProgress = extractProgressData(state);
  const prevProgress = extractProgressData(prevState);

  if (JSON.stringify(currentProgress) !== JSON.stringify(prevProgress)) {
    console.log('[ProgressSync] State changed, triggering sync...', {
      user: state.username,
      changes: {
        xp: prevProgress.totalXP !== currentProgress.totalXP
          ? `${prevProgress.totalXP} → ${currentProgress.totalXP}` : null,
        streak: prevProgress.streak !== currentProgress.streak
          ? `${prevProgress.streak} → ${currentProgress.streak}` : null,
        chapters: prevProgress.chaptersCompleted.length !== currentProgress.chaptersCompleted.length
          ? `${prevProgress.chaptersCompleted.length} → ${currentProgress.chaptersCompleted.length}` : null,
        position: prevProgress.currentChapter !== currentProgress.currentChapter || prevProgress.currentSection !== currentProgress.currentSection
          ? `${prevProgress.currentChapter}:${prevProgress.currentSection} → ${currentProgress.currentChapter}:${currentProgress.currentSection}` : null,
      }
    });
    debouncedSaveProgress(currentProgress);
  }
});

// Handle page unload - force sync
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const state = useProgressStore.getState();
    if (state.username) {
      console.log('[ProgressSync] Page unload detected, forcing immediate sync for user:', state.username);
      cancelPendingSync();
      forceImmediateSync(extractProgressData(state));
    }
  });
}
