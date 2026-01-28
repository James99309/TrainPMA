import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Syllabus, SyllabusProgress, CourseExtended } from '../types';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_QUIZ_API_URL || '';

interface SyllabusState {
  // State
  syllabi: Syllabus[];
  currentSyllabus: Syllabus | null;
  syllabusProgress: Record<string, SyllabusProgress>;
  syllabusCoursesCache: Record<string, CourseExtended[]>;
  loading: boolean;
  error: string | null;

  // Actions
  loadAccessibleSyllabi: (token: string) => Promise<void>;
  setSyllabus: (syllabus: Syllabus | null) => void;
  loadSyllabusCourses: (syllabusId: string, token: string, forceRefresh?: boolean) => Promise<CourseExtended[]>;

  // Progress tracking
  getSyllabusProgress: (syllabusId: string) => SyllabusProgress | undefined;
  updateSyllabusProgress: (syllabusId: string, progress: Partial<SyllabusProgress>) => void;
  markCourseCompletedInSyllabus: (syllabusId: string, courseId: string) => void;
  markCourseStartedInSyllabus: (syllabusId: string, courseId: string) => void;
  isCourseStartedInSyllabus: (syllabusId: string, courseId: string) => boolean;
  syncFromGlobalProgress: (coursesCompleted: string[], syllabusId: string, courseIds: string[]) => void;

  // Computed
  isCourseUnlockedInSyllabus: (syllabusId: string, courseId: string) => boolean;
  getNextCourseInSyllabus: (syllabusId: string) => CourseExtended | undefined;
  getSyllabusCompletionPercentage: (syllabusId: string) => number;

  // Reset
  clearState: () => void;
}

export const useSyllabusStore = create<SyllabusState>()(
  persist(
    (set, get) => ({
      // Initial State
      syllabi: [],
      currentSyllabus: null,
      syllabusProgress: {},
      syllabusCoursesCache: {},
      loading: false,
      error: null,

      // Load accessible syllabi for current user
      loadAccessibleSyllabi: async (token: string) => {
        // Clear existing syllabi and cache when loading new data
        set({ loading: true, error: null, syllabi: [], syllabusCoursesCache: {} });
        try {
          const response = await fetch(`${API_BASE_URL}/api/syllabi`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              set({ syllabi: result.data, loading: false });
              return;
            }
          }

          set({ error: 'Failed to load syllabi', loading: false });
        } catch (error) {
          console.error('Error loading syllabi:', error);
          set({ error: 'Failed to load syllabi', loading: false });
        }
      },

      setSyllabus: (syllabus) => {
        set({ currentSyllabus: syllabus });
      },

      loadSyllabusCourses: async (syllabusId: string, token: string, forceRefresh = false) => {
        // Check cache first (skip if forceRefresh)
        if (!forceRefresh) {
          const cached = get().syllabusCoursesCache[syllabusId];
          if (cached) {
            return cached;
          }
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/syllabi/${syllabusId}/courses`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              set((state) => ({
                syllabusCoursesCache: {
                  ...state.syllabusCoursesCache,
                  [syllabusId]: result.data,
                },
              }));
              return result.data;
            }
          }
          return [];
        } catch (error) {
          console.error('Error loading syllabus courses:', error);
          return [];
        }
      },

      getSyllabusProgress: (syllabusId) => {
        return get().syllabusProgress[syllabusId];
      },

      updateSyllabusProgress: (syllabusId, progress) => {
        set((state) => {
          const existingProgress = state.syllabusProgress[syllabusId];
          return {
            syllabusProgress: {
              ...state.syllabusProgress,
              [syllabusId]: {
                ...existingProgress,
                ...progress,
                syllabusId,
                completedCourses: progress.completedCourses ?? existingProgress?.completedCourses ?? [],
                startedCourses: progress.startedCourses ?? existingProgress?.startedCourses ?? [],
                lastAccessedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      markCourseCompletedInSyllabus: (syllabusId, courseId) => {
        set((state) => {
          const currentProgress = state.syllabusProgress[syllabusId] || {
            syllabusId,
            completedCourses: [],
            startedCourses: [],
          };

          if (!currentProgress.completedCourses.includes(courseId)) {
            return {
              syllabusProgress: {
                ...state.syllabusProgress,
                [syllabusId]: {
                  ...currentProgress,
                  completedCourses: [...currentProgress.completedCourses, courseId],
                  lastAccessedAt: new Date().toISOString(),
                },
              },
            };
          }
          return state;
        });
      },

      markCourseStartedInSyllabus: (syllabusId, courseId) => {
        set((state) => {
          const currentProgress = state.syllabusProgress[syllabusId] || {
            syllabusId,
            completedCourses: [],
            startedCourses: [],
          };

          const startedCourses = currentProgress.startedCourses || [];
          if (!startedCourses.includes(courseId)) {
            return {
              syllabusProgress: {
                ...state.syllabusProgress,
                [syllabusId]: {
                  ...currentProgress,
                  startedCourses: [...startedCourses, courseId],
                  lastAccessedAt: new Date().toISOString(),
                },
              },
            };
          }
          return state;
        });
      },

      isCourseStartedInSyllabus: (syllabusId, courseId) => {
        const progress = get().syllabusProgress[syllabusId];
        const startedCourses = progress?.startedCourses || [];
        return startedCourses.includes(courseId);
      },

      syncFromGlobalProgress: (coursesCompleted, syllabusId, courseIds) => {
        set((state) => {
          const currentProgress = state.syllabusProgress[syllabusId] || {
            syllabusId,
            completedCourses: [],
            startedCourses: [],
          };

          // Find completed courses in this syllabus (those that exist in global coursesCompleted)
          const completedInThisSyllabus = courseIds.filter(id => coursesCompleted.includes(id));

          // Merge existing and newly discovered completed courses
          const mergedCompleted = [...new Set([
            ...currentProgress.completedCourses,
            ...completedInThisSyllabus
          ])];

          // Only update if there are changes
          if (mergedCompleted.length === currentProgress.completedCourses.length &&
              mergedCompleted.every(id => currentProgress.completedCourses.includes(id))) {
            return state;
          }

          return {
            syllabusProgress: {
              ...state.syllabusProgress,
              [syllabusId]: {
                ...currentProgress,
                completedCourses: mergedCompleted,
                lastAccessedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      isCourseUnlockedInSyllabus: (syllabusId, courseId) => {
        const courses = get().syllabusCoursesCache[syllabusId] || [];
        const progress = get().syllabusProgress[syllabusId];
        const completedCourses = progress?.completedCourses || [];

        // Sort courses by order
        const sortedCourses = [...courses].sort(
          (a, b) => (a.order_in_syllabus || a.order || 0) - (b.order_in_syllabus || b.order || 0)
        );

        const courseIndex = sortedCourses.findIndex((c) => c.id === courseId);

        // First course is always unlocked
        if (courseIndex === 0) return true;

        // Course is unlocked if the previous required course is completed
        const prevCourse = sortedCourses[courseIndex - 1];
        if (prevCourse) {
          // If previous course is optional, check the one before it
          if (prevCourse.is_optional) {
            // Find the last non-optional course before this one
            for (let i = courseIndex - 1; i >= 0; i--) {
              if (!sortedCourses[i].is_optional) {
                return completedCourses.includes(sortedCourses[i].id);
              }
            }
            return true; // All previous courses are optional
          }
          return completedCourses.includes(prevCourse.id);
        }

        return false;
      },

      getNextCourseInSyllabus: (syllabusId) => {
        const courses = get().syllabusCoursesCache[syllabusId] || [];
        const progress = get().syllabusProgress[syllabusId];
        const completedCourses = progress?.completedCourses || [];

        // Sort courses by order
        const sortedCourses = [...courses].sort(
          (a, b) => (a.order_in_syllabus || a.order || 0) - (b.order_in_syllabus || b.order || 0)
        );

        // Find the first non-completed course
        return sortedCourses.find((c) => !completedCourses.includes(c.id));
      },

      getSyllabusCompletionPercentage: (syllabusId) => {
        const courses = get().syllabusCoursesCache[syllabusId] || [];
        const progress = get().syllabusProgress[syllabusId];
        const completedCourses = progress?.completedCourses || [];

        if (courses.length === 0) return 0;

        // Only count required courses
        const requiredCourses = courses.filter((c) => !c.is_optional);
        const completedRequired = requiredCourses.filter((c) =>
          completedCourses.includes(c.id)
        );

        if (requiredCourses.length === 0) return 100;
        return Math.round((completedRequired.length / requiredCourses.length) * 100);
      },

      clearState: () => {
        console.log('[SyllabusStore] clearState called - clearing all state including syllabusProgress');
        console.log('[SyllabusStore] BEFORE clear - syllabusProgress:', get().syllabusProgress);
        set({
          syllabi: [],
          currentSyllabus: null,
          syllabusProgress: {},  // 清除大纲进度！这是关键
          syllabusCoursesCache: {},
          loading: false,
          error: null,
        });
        console.log('[SyllabusStore] AFTER clear - syllabusProgress:', get().syllabusProgress);
      },
    }),
    {
      name: 'stargirl-syllabi',
      partialize: (state) => ({
        syllabusProgress: state.syllabusProgress,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('[SyllabusStore] Rehydrated from localStorage:', {
            syllabusProgress: state.syllabusProgress,
            completedCourses: Object.values(state.syllabusProgress || {}).map((p: SyllabusProgress) => ({
              syllabusId: p.syllabusId,
              completed: p.completedCourses?.length || 0,
            })),
          });
        } else {
          console.log('[SyllabusStore] No data in localStorage to rehydrate');
        }
      },
    }
  )
);
