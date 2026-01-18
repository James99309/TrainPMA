import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Header } from './components/Layout/Header';
import { BottomNav, type TabType } from './components/Layout/BottomNav';
import { ChapterList } from './components/Home/ChapterList';
import { ReadingView } from './components/Reading/ReadingView';
import { ChapterComplete } from './components/Gamification/ChapterComplete';
import { XPRewardToast } from './components/Gamification/XPRewardToast';
import { WrongQuestionList } from './components/WrongQuestions/WrongQuestionList';
import { WrongQuestionPractice } from './components/WrongQuestions/WrongQuestionPractice';
import { ProfileView } from './components/Profile/ProfileView';
import { LeaderboardView } from './components/Leaderboard/LeaderboardView';
import { LoginScreen } from './components/Auth/LoginScreen';
import { CourseList } from './components/Course/CourseList';
import { CourseView } from './components/Course/CourseView';
import { SurveyQuiz } from './components/Survey/SurveyQuiz';
import { SurveyResult } from './components/Survey/SurveyResult';
import { SyllabusList, SyllabusView } from './components/Syllabus';
import { AdminPage } from './pages/Admin';
import { useProgressStore } from './stores/progressStore';
import { useCourseStore } from './stores/courseStore';
import { useSyllabusStore } from './stores/syllabusStore';
import { useWrongQuestionStore } from './stores/wrongQuestionStore';
import { showXPToast } from './stores/xpToastStore';
import { recordProgress } from './services/sheetApi';
import authApi from './services/authApi';
import { cancelPendingSync, forceImmediateSync, setAuthToken, clearAuthToken } from './services/progressApi';
import bookData from './data/stargirl.json';
import type { Course, CourseExtended, UserInfo, WrongQuestion, Syllabus } from './types';
import './index.css';

interface Chapter {
  id: number;
  title: string;
  content: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}

type View = 'home' | 'reading' | 'complete' | 'course' | 'courseView' | 'quiz' | 'quizResult' | 'wrongPractice' | 'syllabusList' | 'syllabusView';

interface QuizResult {
  passed: boolean;
  score: number;
  maxScore: number;
  percentage: number;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('syllabus');
  const [currentView, setCurrentView] = useState<View>('syllabusList');
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [sessionXP, setSessionXP] = useState(0);
  const [sessionWords, setSessionWords] = useState(0);
  const [, setLastQuizScore] = useState<string>('');
  const [currentSurveyId, setCurrentSurveyId] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [appMode, setAppMode] = useState<'course' | 'read'>('course');
  const [practiceQuestions, setPracticeQuestions] = useState<WrongQuestion[]>([]);
  const [currentSyllabus, setCurrentSyllabus] = useState<Syllabus | null>(null);

  const { username, setUsername, checkAndRestoreHearts, darkMode, loadFromServer, claimDailyLoginReward } = useProgressStore();
  const { currentCourse, setCourse, setSurveyUserInfo, clearUserInfo, clearCourseProgress, surveyUserInfo } = useCourseStore();
  const { markCourseCompletedInSyllabus, markCourseStartedInSyllabus, clearState: clearSyllabusState } = useSyllabusStore();
  const chapters = bookData.chapters as Chapter[];
  const hasClaimedLoginReward = useRef(false);
  const hasRestoredAuth = useRef(false);

  // Check if we're on the admin page
  const isAdminPage = window.location.pathname === '/admin' || window.location.pathname === '/admin/';

  // Return admin page if on admin route
  if (isAdminPage) {
    return <AdminPage />;
  }

  // Restore auth data on app mount ONLY (not on every surveyUserInfo change)
  // This runs once when the component mounts to handle page refresh scenario
  useEffect(() => {
    // Only run once on mount
    if (hasRestoredAuth.current) return;
    hasRestoredAuth.current = true;

    // Get the current state directly from store to avoid stale closure
    const currentSurveyUserInfo = useCourseStore.getState().surveyUserInfo;

    if (currentSurveyUserInfo) {
      if (currentSurveyUserInfo.token) {
        // Token already exists in store (from Zustand persist after page refresh)
        // Ensure it's also set in progressApi for auto-sync
        console.log('[Auth] Token found in persisted store, setting in progressApi');
        setAuthToken(currentSurveyUserInfo.token);
      } else {
        // No token in store, try to restore from localStorage (Remember Me case)
        const savedUser = authApi.getSavedAuthData();
        if (savedUser && savedUser.token) {
          setSurveyUserInfo({
            user_id: savedUser.user_id,
            name: savedUser.name,
            company: savedUser.company,
            phone: savedUser.phone,
            user_type: savedUser.user_type,
            employee_info: savedUser.employee_info,
            token: savedUser.token,
          });
          // Set token in progressApi for auto-sync
          setAuthToken(savedUser.token);
          if (savedUser.progress) {
            loadFromServer(savedUser.progress);
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency - run only once on mount

  // Apply dark mode to document root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Check and restore hearts on app load and every minute
  useEffect(() => {
    checkAndRestoreHearts();
    const interval = setInterval(checkAndRestoreHearts, 60000);
    return () => clearInterval(interval);
  }, [checkAndRestoreHearts]);

  // NOTE: Removed useEffect that was overwriting surveyUserInfo with only { name: username }
  // This was causing the token to be lost after login

  // Check and claim daily login reward
  useEffect(() => {
    if (username && !hasClaimedLoginReward.current) {
      hasClaimedLoginReward.current = true;
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        const result = claimDailyLoginReward();
        if (result.earned) {
          showXPToast({
            amount: result.xp,
            reason: '每日登录奖励',
            icon: '📅',
          });
          if (result.streakBonus > 0) {
            // Show streak bonus after a short delay
            setTimeout(() => {
              showXPToast({
                amount: result.streakBonus,
                reason: `连续学习加成`,
                icon: '🔥',
              });
            }, 2800);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [username, claimDailyLoginReward]);

  // Handle login with UserInfo (supports both guest and employee)
  const handleLogin = (userInfo: UserInfo | string) => {
    // DEBUG: Show localStorage state at login
    console.log('[Login] ========== LOGIN DEBUG START ==========');
    console.log('[Login] localStorage keys at login:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('stargirl')) {
        console.log(`  - ${key}:`, localStorage.getItem(key)?.substring(0, 100) + '...');
      }
    }
    console.log('[Login] Current syllabusProgress:', useSyllabusStore.getState().syllabusProgress);
    console.log('[Login] Current courseProgress:', useCourseStore.getState().courseProgress);

    // Support both old string format and new UserInfo format
    if (typeof userInfo === 'string') {
      // Clear old user data if different user is logging in
      const currentStore = useProgressStore.getState();
      if (currentStore.username && currentStore.username !== userInfo) {
        currentStore.logout();
      }
      setUsername(userInfo);
      setSurveyUserInfo({ name: userInfo });
      recordProgress({
        username: userInfo,
        chapter: 'Login',
        score: '-',
        xp: 0,
      });
    } else {
      // New UserInfo format
      // Clear old user data if different user is logging in to prevent data pollution
      // Guest: compare by phone, Employee: compare by employee_id
      const currentSurveyUser = useCourseStore.getState().surveyUserInfo;
      let shouldClearData = false;

      if (currentSurveyUser) {
        if (userInfo.user_type === 'employee') {
          // 员工：用 employee_id 比较
          const oldEmployeeId = currentSurveyUser.employee_info?.employee_id;
          const newEmployeeId = userInfo.employee_info?.employee_id;
          if (oldEmployeeId && newEmployeeId && oldEmployeeId !== newEmployeeId) {
            console.log(`[Auth] Different employee logging in: ${oldEmployeeId} -> ${newEmployeeId}`);
            shouldClearData = true;
          }
          // 从客人切换到员工
          if (currentSurveyUser.user_type === 'guest') {
            console.log('[Auth] Switching from guest to employee');
            shouldClearData = true;
          }
        } else {
          // 客人：用 phone 比较
          const oldPhone = currentSurveyUser.phone;
          const newPhone = userInfo.phone;
          if (oldPhone && newPhone && oldPhone !== newPhone) {
            console.log(`[Auth] Different guest logging in: ${oldPhone} -> ${newPhone}`);
            shouldClearData = true;
          }
          // 从员工切换到客人
          if (currentSurveyUser.user_type === 'employee') {
            console.log('[Auth] Switching from employee to guest');
            shouldClearData = true;
          }
        }
      }

      if (shouldClearData) {
        console.log('[Auth] Clearing old user data');
        useProgressStore.getState().logout();
        useWrongQuestionStore.getState().clearAll();
        // 清除课程和大纲进度
        localStorage.removeItem('stargirl-courses');
        localStorage.removeItem('stargirl-syllabi');
        useCourseStore.getState().clearCourseProgress();
        useSyllabusStore.getState().clearState();
      }

      setUsername(userInfo.name);
      setSurveyUserInfo({
        user_id: userInfo.user_id,
        name: userInfo.name,
        company: userInfo.company,
        phone: userInfo.phone,
        user_type: userInfo.user_type,
        employee_info: userInfo.employee_info,
        token: userInfo.token,
      });

      // Set token in progressApi for auto-sync (handles non-rememberMe case)
      if (userInfo.token) {
        setAuthToken(userInfo.token);
      }

      // Load progress from server if available
      // Server is the single source of truth
      console.log('========== LOGIN DEBUG ==========');
      console.log('[Login] userInfo.progress exists:', !!userInfo.progress);
      if (userInfo.progress) {
        console.log('[Login] Progress from server:', {
          hearts: userInfo.progress.hearts,
          totalXP: userInfo.progress.totalXP,
          streak: userInfo.progress.streak,
          chaptersCompleted: userInfo.progress.chaptersCompleted,
        });
        loadFromServer(userInfo.progress);
        console.log('[Login] Progress loaded from login response');
      } else {
        console.log('[Login] ⚠️ No progress data in login response!');
      }
      console.log('========== LOGIN DEBUG END ==========')

      recordProgress({
        username: userInfo.name,
        chapter: 'Login',
        score: '-',
        xp: 0,
      });
    }
  };

  // Handle logout - async to ensure data sync completes before clearing
  const handleLogout = async () => {
    // DEBUG: Log current state before logout
    const currentState = useProgressStore.getState();
    const progressData = currentState.getProgressData();
    console.log('========== LOGOUT DEBUG START ==========');
    console.log('[Logout] Current username:', currentState.username);
    console.log('[Logout] Current progress BEFORE sync:', {
      hearts: progressData.hearts,
      totalXP: progressData.totalXP,
      streak: progressData.streak,
      chaptersCompleted: progressData.chaptersCompleted,
      wrongQuestions: progressData.wrongQuestions?.length || 0,
    });

    // Get token from both sources - surveyUserInfo.token (for non-rememberMe) or localStorage (for rememberMe)
    const token = surveyUserInfo?.token || localStorage.getItem('auth_token');
    console.log('[Logout] Auth token from surveyUserInfo:', !!surveyUserInfo?.token);
    console.log('[Logout] Auth token from localStorage:', !!localStorage.getItem('auth_token'));
    console.log('[Logout] Token exists:', !!token);

    // IMPORTANT: Force sync current progress to server BEFORE clearing local data
    // This prevents data loss when user has pending debounced saves
    cancelPendingSync();  // Cancel any pending debounced save
    console.log('[Logout] Cancelled pending sync, now forcing immediate sync...');

    // AWAIT the sync to complete before clearing data
    // Pass the token explicitly to handle non-rememberMe case where token is only in Zustand store
    const syncSuccess = await forceImmediateSync(progressData, token || undefined);
    console.log('[Logout] forceImmediateSync completed, success:', syncSuccess);
    console.log('[Logout] Now clearing local data...');
    console.log('========== LOGOUT DEBUG END ==========');

    // DEBUG: Show all stargirl-related localStorage keys before clearing
    console.log('[Logout] ========== CLEARING DATA ==========');
    console.log('[Logout] localStorage keys before clear:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('stargirl')) {
        console.log(`  - ${key}:`, localStorage.getItem(key)?.substring(0, 100) + '...');
      }
    }

    // Clear auth data from localStorage and in-memory
    authApi.clearAuthData();
    clearAuthToken();  // Clear in-memory token in progressApi
    // Clear progress store (including localStorage) to prevent data pollution
    console.log('[Logout] Calling progressStore.logout()...');
    useProgressStore.getState().logout();
    // Clear course progress to prevent data pollution between users
    console.log('[Logout] Removing stargirl-courses from localStorage...');
    localStorage.removeItem('stargirl-courses');
    clearCourseProgress();
    // Clear syllabus progress to prevent data pollution between users
    console.log('[Logout] Removing stargirl-syllabi from localStorage...');
    localStorage.removeItem('stargirl-syllabi');
    clearSyllabusState();

    // DEBUG: Verify localStorage is cleared
    console.log('[Logout] localStorage keys after clear:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('stargirl')) {
        console.log(`  - ${key}: STILL EXISTS!`, localStorage.getItem(key)?.substring(0, 100) + '...');
      }
    }
    console.log('[Logout] ========== CLEAR COMPLETE ==========');
    // Clear wrong questions data
    useWrongQuestionStore.getState().clearAll();
    // Clear username from progress store (redundant after logout(), but kept for clarity)
    setUsername('');
    // Clear user info from course store
    clearUserInfo();
    // Reset auth restored flag
    hasRestoredAuth.current = false;
    // Reset view state
    setCurrentView('syllabusList');
    setCourse(null);
    setSelectedChapter(null);
    setCurrentSyllabus(null);
  };

  // Chapter-based reading handlers
  const handleSelectChapter = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setCurrentView('reading');
    setSessionXP(0);
    setSessionWords(0);
    setLastQuizScore('');
  };

  const handleChapterComplete = (quizScore?: string) => {
    if (quizScore) {
      setLastQuizScore(quizScore);
    }
    setCurrentView('complete');

    if (username && selectedChapter) {
      recordProgress({
        username,
        chapter: selectedChapter.title,
        score: quizScore || 'No quiz',
        xp: 50 + (quizScore ? 30 : 0),
      });
    }
  };

  const handleContinueAfterComplete = () => {
    setCurrentView('home');
    setSelectedChapter(null);
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedChapter(null);
    setCourse(null);
    setCurrentSurveyId(null);
    setQuizResult(null);
  };

  // Course handlers
  const handleSelectCourse = (course: Course) => {
    setCourse(course);
    setCurrentView('courseView');
  };

  const handleCourseComplete = () => {
    setCurrentView('home');
    setCourse(null);
  };

  const handleStartQuiz = (surveyId: string) => {
    setCurrentSurveyId(surveyId);
    setCurrentView('quiz');
  };

  const handleQuizComplete = (result: QuizResult) => {
    setQuizResult(result);
    setCurrentView('quizResult');
  };

  const handleQuizResultContinue = () => {
    if (currentCourse) {
      setCurrentView('courseView');
    } else {
      setCurrentView('home');
    }
    setCurrentSurveyId(null);
    setQuizResult(null);
  };

  const handleRetryQuiz = () => {
    if (currentSurveyId) {
      setCurrentView('quiz');
      setQuizResult(null);
    }
  };

  // 错题练习处理
  const handleStartWrongPractice = (questions: WrongQuestion[]) => {
    setPracticeQuestions(questions);
    setCurrentView('wrongPractice');
  };

  const handleWrongPracticeComplete = () => {
    setCurrentView('home');
    setPracticeQuestions([]);
  };

  // Syllabus handlers
  const handleSelectSyllabus = (syllabus: Syllabus) => {
    setCurrentSyllabus(syllabus);
    setCurrentView('syllabusView');
  };

  const handleBackFromSyllabus = () => {
    setCurrentSyllabus(null);
    setCurrentView('syllabusList');
  };

  const handleSelectCourseFromSyllabus = (course: CourseExtended) => {
    // 标记课程为已开始
    if (currentSyllabus) {
      markCourseStartedInSyllabus(currentSyllabus.id, course.id);
    }
    setCourse(course);
    setCurrentView('courseView');
  };

  const handleCourseCompleteInSyllabus = () => {
    // Mark course as completed in syllabus progress
    if (currentSyllabus && currentCourse) {
      markCourseCompletedInSyllabus(currentSyllabus.id, currentCourse.id);
    }
    // Go back to syllabus view
    if (currentSyllabus) {
      setCurrentView('syllabusView');
    } else {
      setCurrentView('syllabusList');
    }
    setCourse(null);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'syllabus') {
      setAppMode('course');
      setCurrentView('syllabusList');
      setSelectedChapter(null);
      setCourse(null);
      setCurrentSyllabus(null);
      setPracticeQuestions([]);
    } else if (tab === 'course') {
      setAppMode('course');
      setCurrentView('home');
      setSelectedChapter(null);
      setCourse(null);
      setCurrentSyllabus(null);
      setPracticeQuestions([]);
    } else if (tab === 'read') {
      setAppMode('read');
      setCurrentView('home');
      setSelectedChapter(null);
      setCourse(null);
      setCurrentSyllabus(null);
      setPracticeQuestions([]);
    } else if (tab === 'wrong') {
      setCurrentView('home');
      setPracticeQuestions([]);
    }
  };

  // Show login screen if not logged in
  if (!username) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const renderContent = () => {
    // 错题练习视图（优先处理，跨Tab）
    if (currentView === 'wrongPractice' && practiceQuestions.length > 0) {
      return (
        <WrongQuestionPractice
          questions={practiceQuestions}
          onComplete={handleWrongPracticeComplete}
          onClose={handleWrongPracticeComplete}
        />
      );
    }

    // Common tabs
    if (activeTab === 'wrong') {
      return (
        <WrongQuestionList
          onStartPractice={handleStartWrongPractice}
        />
      );
    }

    if (activeTab === 'leaderboard') {
      return <LeaderboardView />;
    }

    if (activeTab === 'profile') {
      return <ProfileView />;
    }

    // Syllabus tab (Training)
    if (activeTab === 'syllabus') {
      switch (currentView) {
        case 'syllabusView':
          return currentSyllabus && surveyUserInfo?.token ? (
            <SyllabusView
              syllabus={currentSyllabus}
              token={surveyUserInfo.token}
              onBack={handleBackFromSyllabus}
              onSelectCourse={handleSelectCourseFromSyllabus}
            />
          ) : null;

        case 'courseView':
          return currentCourse ? (
            <CourseView
              course={currentCourse}
              onBack={() => {
                setCourse(null);
                setCurrentView('syllabusView');
              }}
              onStartQuiz={handleStartQuiz}
              onComplete={handleCourseCompleteInSyllabus}
            />
          ) : null;

        case 'quiz':
          return currentSurveyId ? (
            <SurveyQuiz
              surveyId={currentSurveyId}
              courseId={currentCourse?.id}
              passScore={currentCourse?.quiz?.pass_score || 60}
              onComplete={handleQuizComplete}
              onClose={() => {
                if (currentCourse) {
                  setCurrentView('courseView');
                } else if (currentSyllabus) {
                  setCurrentView('syllabusView');
                } else {
                  setCurrentView('syllabusList');
                }
                setCurrentSurveyId(null);
              }}
            />
          ) : null;

        case 'quizResult':
          return quizResult && currentSurveyId ? (
            <SurveyResult
              surveyId={currentSurveyId}
              passed={quizResult.passed}
              score={quizResult.score}
              maxScore={quizResult.maxScore}
              percentage={quizResult.percentage}
              passScore={currentCourse?.quiz?.pass_score || 60}
              onContinue={() => {
                // If passed, go back to syllabus view
                if (quizResult.passed) {
                  handleCourseCompleteInSyllabus();
                } else {
                  handleQuizResultContinue();
                }
              }}
              onRetry={!quizResult.passed ? handleRetryQuiz : undefined}
            />
          ) : null;

        default:
          return surveyUserInfo?.token ? (
            <div className="pt-14 pb-20 min-h-screen bg-gray-50 dark:bg-gray-900">
              <SyllabusList
                token={surveyUserInfo.token}
                onSelectSyllabus={handleSelectSyllabus}
              />
            </div>
          ) : (
            <div className="pt-14 pb-20 min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <p className="text-gray-500">Please log in to view training programs</p>
            </div>
          );
      }
    }

    // Course tab
    if (activeTab === 'course') {
      switch (currentView) {
        case 'courseView':
          return currentCourse ? (
            <CourseView
              course={currentCourse}
              onBack={handleBackToHome}
              onStartQuiz={handleStartQuiz}
              onComplete={handleCourseComplete}
            />
          ) : null;

        case 'quiz':
          return currentSurveyId ? (
            <SurveyQuiz
              surveyId={currentSurveyId}
              courseId={currentCourse?.id}
              passScore={currentCourse?.quiz?.pass_score || 60}
              onComplete={handleQuizComplete}
              onClose={() => {
                if (currentCourse) {
                  setCurrentView('courseView');
                } else {
                  setCurrentView('home');
                }
                setCurrentSurveyId(null);
              }}
            />
          ) : null;

        case 'quizResult':
          return quizResult && currentSurveyId ? (
            <SurveyResult
              surveyId={currentSurveyId}
              passed={quizResult.passed}
              score={quizResult.score}
              maxScore={quizResult.maxScore}
              percentage={quizResult.percentage}
              passScore={currentCourse?.quiz?.pass_score || 60}
              onContinue={handleQuizResultContinue}
              onRetry={!quizResult.passed ? handleRetryQuiz : undefined}
            />
          ) : null;

        default:
          return (
            <div className="pt-14 pb-20 min-h-screen bg-gray-50 dark:bg-gray-900">
              <CourseList onSelectCourse={handleSelectCourse} />
            </div>
          );
      }
    }

    // Read tab (original Stargirl reading)
    if (activeTab === 'read') {
      switch (currentView) {
        case 'reading':
          return selectedChapter ? (
            <ReadingView
              chapter={selectedChapter}
              onComplete={() => handleChapterComplete()}
              onQuizComplete={(score) => handleChapterComplete(score)}
              onBack={handleBackToHome}
            />
          ) : null;

        case 'complete':
          return selectedChapter ? (
            <ChapterComplete
              chapterId={selectedChapter.id}
              xpEarned={sessionXP}
              wordsLearned={sessionWords}
              onContinue={handleContinueAfterComplete}
            />
          ) : null;

        default:
          return (
            <div className="pt-14 pb-20 px-4 min-h-screen bg-gray-50 dark:bg-gray-900">
              <ChapterList
                chapters={chapters}
                onSelectChapter={handleSelectChapter}
              />
            </div>
          );
      }
    }

    return null;
  };

  const showNavigation =
    currentView !== 'complete' &&
    currentView !== 'reading' &&
    currentView !== 'quiz' &&
    currentView !== 'quizResult' &&
    currentView !== 'courseView' &&
    currentView !== 'wrongPractice' &&
    currentView !== 'syllabusView';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {showNavigation && <Header onLogout={handleLogout} />}

      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>

      {showNavigation && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} mode={appMode} />
      )}

      {/* XP 奖励弹出动画 */}
      <XPRewardToast />
    </div>
  );
}

export default App;
