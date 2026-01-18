import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WrongQuestion, SurveyQuestion } from '../types';
import { useProgressStore } from './progressStore';

interface WrongQuestionState {
  wrongQuestions: WrongQuestion[];

  // Actions
  addWrongQuestion: (
    surveyId: string,
    question: SurveyQuestion,
    userAnswer: string | string[],
    courseId?: string,
    courseName?: string
  ) => void;
  markAsResolved: (questionId: string) => void;
  markAsUnresolved: (questionId: string) => void;
  removeQuestion: (questionId: string) => void;
  clearAllResolved: () => void;
  clearAll: () => void;
  loadFromServer: (questions: WrongQuestion[]) => void;  // Load from server on login

  // Getters
  getUnresolvedQuestions: () => WrongQuestion[];
  getQuestionsByCourse: () => Map<string, WrongQuestion[]>;
  getTotalCount: () => number;
  getUnresolvedCount: () => number;
}

export const useWrongQuestionStore = create<WrongQuestionState>()(
  persist(
    (set, get) => ({
      wrongQuestions: [],

      addWrongQuestion: (surveyId, question, userAnswer, courseId, courseName) => {
        const id = `${surveyId}_${question.id}`;
        const existingIndex = get().wrongQuestions.findIndex(q => q.id === id);

        if (existingIndex >= 0) {
          // 已存在，更新答错次数和时间
          set((state) => ({
            wrongQuestions: state.wrongQuestions.map((q, index) =>
              index === existingIndex
                ? {
                    ...q,
                    userAnswer,
                    wrongCount: q.wrongCount + 1,
                    lastWrongAt: new Date().toISOString(),
                    isResolved: false, // 重新答错，取消已掌握状态
                  }
                : q
            ),
          }));
        } else {
          // 新增错题
          const newWrongQuestion: WrongQuestion = {
            id,
            surveyId,
            courseId,
            courseName,
            questionText: question.question_text,
            questionType: question.question_type,
            options: question.options,
            userAnswer,
            correctAnswer: question.correct_answer,
            explanation: question.explanation,
            score: question.score,
            wrongCount: 1,
            lastWrongAt: new Date().toISOString(),
            isResolved: false,
          };

          set((state) => ({
            wrongQuestions: [...state.wrongQuestions, newWrongQuestion],
          }));
        }
      },

      markAsResolved: (questionId) => {
        set((state) => ({
          wrongQuestions: state.wrongQuestions.map((q) =>
            q.id === questionId ? { ...q, isResolved: true } : q
          ),
        }));
      },

      markAsUnresolved: (questionId) => {
        set((state) => ({
          wrongQuestions: state.wrongQuestions.map((q) =>
            q.id === questionId ? { ...q, isResolved: false } : q
          ),
        }));
      },

      removeQuestion: (questionId) => {
        set((state) => ({
          wrongQuestions: state.wrongQuestions.filter((q) => q.id !== questionId),
        }));
      },

      clearAllResolved: () => {
        set((state) => ({
          wrongQuestions: state.wrongQuestions.filter((q) => !q.isResolved),
        }));
      },

      clearAll: () => {
        set({ wrongQuestions: [] });
      },

      loadFromServer: (questions) => {
        console.log('[WrongQuestionStore] Loading', questions.length, 'questions from server');
        set({ wrongQuestions: questions });
      },

      getUnresolvedQuestions: () => {
        return get().wrongQuestions.filter((q) => !q.isResolved);
      },

      getQuestionsByCourse: () => {
        const grouped = new Map<string, WrongQuestion[]>();
        const questions = get().wrongQuestions;

        questions.forEach((q) => {
          const key = q.courseName || '未分类';
          const existing = grouped.get(key) || [];
          grouped.set(key, [...existing, q]);
        });

        return grouped;
      },

      getTotalCount: () => {
        return get().wrongQuestions.length;
      },

      getUnresolvedCount: () => {
        return get().wrongQuestions.filter((q) => !q.isResolved).length;
      },
    }),
    {
      name: 'stargirl-wrong-questions',
    }
  )
);

// 跨 store 订阅：当错题数据变化时，触发进度同步
useWrongQuestionStore.subscribe((state, prevState) => {
  // 只在错题数据实际变化时触发同步
  if (state.wrongQuestions !== prevState.wrongQuestions) {
    // 获取 username 判断是否已登录
    const { username, triggerSync } = useProgressStore.getState();
    if (username) {
      console.log('[WrongQuestionStore] Questions changed, triggering progress sync...');
      triggerSync();
    }
  }
});
