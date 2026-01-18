import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Course, CourseProgress, SurveyQuestion, SurveyAnswer, UserType, EmployeeInfo } from '../types';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_QUIZ_API_URL || '';

interface CourseState {
  // State
  courses: Course[];
  currentCourse: Course | null;
  currentPage: number;
  courseProgress: Record<string, CourseProgress>;

  // Survey State
  currentSurveyId: string | null;
  surveyQuestions: SurveyQuestion[];
  surveyAnswers: SurveyAnswer[];
  currentQuestionIndex: number;
  surveyStartTime: number | null;

  // User info for survey (extended to support both guest and employee)
  surveyUserInfo: {
    user_id?: string;
    name: string;
    company?: string;
    phone?: string;
    user_type?: UserType;
    employee_info?: EmployeeInfo;
    token?: string;
  } | null;

  // Actions - Course
  loadCourses: () => Promise<void>;
  setCourse: (course: Course | null) => void;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  markCourseComplete: (courseId: string) => void;
  getCourseProgress: (courseId: string) => CourseProgress | undefined;
  updateCourseProgress: (courseId: string, progress: Partial<CourseProgress>) => void;

  // Actions - Survey
  setSurveyId: (surveyId: string | null) => void;
  setSurveyQuestions: (questions: SurveyQuestion[]) => void;
  startSurvey: () => void;
  setCurrentQuestionIndex: (index: number) => void;
  submitAnswer: (answer: SurveyAnswer) => void;
  clearSurveyState: () => void;
  setSurveyUserInfo: (info: { user_id?: string; name: string; company?: string; phone?: string; user_type?: UserType; employee_info?: EmployeeInfo; token?: string }) => void;
  clearUserInfo: () => void;
  clearCourseProgress: () => void;
  isEmployee: () => boolean;

  // Computed
  getCompletedCourses: () => string[];
  getNextCourse: () => Course | undefined;
  isCourseUnlocked: (courseId: string) => boolean;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set, get) => ({
      // Initial State
      courses: [],
      currentCourse: null,
      currentPage: 1,
      courseProgress: {},
      currentSurveyId: null,
      surveyQuestions: [],
      surveyAnswers: [],
      currentQuestionIndex: 0,
      surveyStartTime: null,
      surveyUserInfo: null,

      // Course Actions
      loadCourses: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/courses`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              set({ courses: result.data });
              return;
            }
          }
          console.error('Failed to load courses from API');
        } catch (error) {
          console.error('Error loading courses:', error);
        }
        // Fallback: keep existing courses if API fails
      },

      setCourse: (course) => {
        const progress = course ? get().getCourseProgress(course.id) : undefined;
        set({
          currentCourse: course,
          currentPage: progress?.currentPage || 1,
        });
      },

      setPage: (page) => {
        const { currentCourse, updateCourseProgress } = get();
        set({ currentPage: page });

        if (currentCourse) {
          updateCourseProgress(currentCourse.id, { currentPage: page });
        }
      },

      nextPage: () => {
        const { currentPage, currentCourse, setPage, markCourseComplete } = get();
        const totalPages = currentCourse?.totalPages || 1;

        if (currentPage < totalPages) {
          setPage(currentPage + 1);
        } else if (currentCourse && currentPage >= totalPages) {
          markCourseComplete(currentCourse.id);
        }
      },

      prevPage: () => {
        const { currentPage, setPage } = get();
        if (currentPage > 1) {
          setPage(currentPage - 1);
        }
      },

      markCourseComplete: (courseId) => {
        set((state) => ({
          courseProgress: {
            ...state.courseProgress,
            [courseId]: {
              ...state.courseProgress[courseId],
              courseId,
              isCompleted: true,
              completedAt: new Date().toISOString(),
              currentPage: state.currentCourse?.totalPages || 1,
              totalPages: state.currentCourse?.totalPages || 1,
            },
          },
        }));
      },

      getCourseProgress: (courseId) => {
        return get().courseProgress[courseId];
      },

      updateCourseProgress: (courseId, progress) => {
        set((state) => ({
          courseProgress: {
            ...state.courseProgress,
            [courseId]: {
              ...state.courseProgress[courseId],
              courseId,
              totalPages: state.currentCourse?.totalPages || 1,
              currentPage: 1,
              isCompleted: false,
              ...progress,
            },
          },
        }));
      },

      // Survey Actions
      setSurveyId: (surveyId) => {
        set({ currentSurveyId: surveyId });
      },

      setSurveyQuestions: (questions) => {
        set({ surveyQuestions: questions });
      },

      startSurvey: () => {
        set({
          surveyStartTime: Date.now(),
          currentQuestionIndex: 0,
          surveyAnswers: [],
        });
      },

      setCurrentQuestionIndex: (index) => {
        set({ currentQuestionIndex: index });
      },

      submitAnswer: (answer) => {
        set((state) => {
          const existingIndex = state.surveyAnswers.findIndex(
            a => a.question_id === answer.question_id
          );

          if (existingIndex >= 0) {
            const newAnswers = [...state.surveyAnswers];
            newAnswers[existingIndex] = answer;
            return { surveyAnswers: newAnswers };
          }

          return { surveyAnswers: [...state.surveyAnswers, answer] };
        });
      },

      clearSurveyState: () => {
        set({
          currentSurveyId: null,
          surveyQuestions: [],
          surveyAnswers: [],
          currentQuestionIndex: 0,
          surveyStartTime: null,
        });
      },

      setSurveyUserInfo: (info) => {
        set({ surveyUserInfo: info });
      },

      clearUserInfo: () => {
        set({ surveyUserInfo: null });
      },

      clearCourseProgress: () => {
        console.log('[CourseStore] clearCourseProgress called');
        console.log('[CourseStore] BEFORE clear - courseProgress:', get().courseProgress);
        set({ courseProgress: {} });
        console.log('[CourseStore] AFTER clear - courseProgress:', get().courseProgress);
      },

      isEmployee: () => {
        const { surveyUserInfo } = get();
        return surveyUserInfo?.user_type === 'employee';
      },

      // Computed Actions
      getCompletedCourses: () => {
        const { courseProgress } = get();
        return Object.entries(courseProgress)
          .filter(([_, progress]) => progress.isCompleted)
          .map(([courseId]) => courseId);
      },

      getNextCourse: () => {
        const { courses, getCompletedCourses } = get();
        const completed = getCompletedCourses();
        return courses.find(c => !completed.includes(c.id));
      },

      isCourseUnlocked: (courseId) => {
        const { courses, getCompletedCourses } = get();
        const completed = getCompletedCourses();
        const courseIndex = courses.findIndex(c => c.id === courseId);

        // First course is always unlocked
        if (courseIndex === 0) return true;

        // Course is unlocked if the previous course is completed
        const prevCourse = courses[courseIndex - 1];
        return prevCourse ? completed.includes(prevCourse.id) : false;
      },
    }),
    {
      name: 'stargirl-courses',
      partialize: (state) => ({
        courseProgress: state.courseProgress,
        surveyUserInfo: state.surveyUserInfo,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('[CourseStore] Rehydrated from localStorage:', {
            courseProgress: state.courseProgress,
            surveyUserInfo: state.surveyUserInfo ? {
              user_id: state.surveyUserInfo.user_id,
              name: state.surveyUserInfo.name,
              user_type: state.surveyUserInfo.user_type,
              hasToken: !!state.surveyUserInfo.token,
            } : null,
          });
        } else {
          console.log('[CourseStore] No data in localStorage to rehydrate');
        }
      },
    }
  )
);
