import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VocabularyItem } from '../types';

interface VocabularyState {
  vocabulary: Record<string, VocabularyItem>;
  savedWords: string[];

  // Actions
  initializeWord: (word: VocabularyItem) => void;
  markWordViewed: (word: string) => void;
  saveWord: (word: string) => void;
  unsaveWord: (word: string) => void;
  deleteWord: (word: string) => void;
  recordAnswer: (word: string, correct: boolean) => void;
  getWordsForReview: () => VocabularyItem[];
  getMasteredWords: () => VocabularyItem[];
  getLearningWords: () => VocabularyItem[];
}

// Simple spaced repetition intervals (in hours)
const REVIEW_INTERVALS = [1, 4, 24, 72, 168, 336, 720]; // 1h, 4h, 1d, 3d, 1w, 2w, 1m

function calculateNextReview(timesCorrect: number): string {
  const intervalIndex = Math.min(timesCorrect, REVIEW_INTERVALS.length - 1);
  const hours = REVIEW_INTERVALS[intervalIndex];
  const nextDate = new Date();
  nextDate.setHours(nextDate.getHours() + hours);
  return nextDate.toISOString();
}

export const useVocabularyStore = create<VocabularyState>()(
  persist(
    (set, get) => ({
      vocabulary: {},
      savedWords: [],

      initializeWord: (word) => {
        const { vocabulary } = get();
        if (!vocabulary[word.word]) {
          set({
            vocabulary: {
              ...vocabulary,
              [word.word]: word,
            },
          });
        }
      },

      markWordViewed: (word) => {
        set((state) => {
          const existingWord = state.vocabulary[word];
          if (existingWord) {
            return {
              vocabulary: {
                ...state.vocabulary,
                [word]: {
                  ...existingWord,
                  isNew: false,
                },
              },
            };
          }
          return state;
        });
      },

      saveWord: (word) => {
        set((state) => ({
          savedWords: state.savedWords.includes(word)
            ? state.savedWords
            : [...state.savedWords, word],
          vocabulary: {
            ...state.vocabulary,
            [word]: {
              ...state.vocabulary[word],
              isSaved: true,
            },
          },
        }));
      },

      unsaveWord: (word) => {
        set((state) => ({
          savedWords: state.savedWords.filter((w) => w !== word),
          vocabulary: {
            ...state.vocabulary,
            [word]: {
              ...state.vocabulary[word],
              isSaved: false,
            },
          },
        }));
      },

      deleteWord: (word) => {
        set((state) => {
          const { [word]: _, ...rest } = state.vocabulary;
          return {
            vocabulary: rest,
            savedWords: state.savedWords.filter((w) => w !== word),
          };
        });
      },

      recordAnswer: (word, correct) => {
        set((state) => {
          const existingWord = state.vocabulary[word];
          if (!existingWord) return state;

          const newTimesCorrect = correct
            ? existingWord.timesCorrect + 1
            : Math.max(0, existingWord.timesCorrect - 1);
          const newTimesIncorrect = correct
            ? existingWord.timesIncorrect
            : existingWord.timesIncorrect + 1;

          // Calculate mastery level (0-100)
          const totalAttempts = newTimesCorrect + newTimesIncorrect;
          const masteryLevel =
            totalAttempts > 0
              ? Math.min(100, Math.round((newTimesCorrect / totalAttempts) * 100 * (Math.min(totalAttempts, 10) / 10)))
              : 0;

          return {
            vocabulary: {
              ...state.vocabulary,
              [word]: {
                ...existingWord,
                timesCorrect: newTimesCorrect,
                timesIncorrect: newTimesIncorrect,
                masteryLevel,
                lastReviewed: new Date().toISOString(),
                // 答对用间隔重复，答错立即可复习
                nextReview: correct ? calculateNextReview(newTimesCorrect) : null,
              },
            },
          };
        });
      },

      getWordsForReview: () => {
        const { vocabulary } = get();
        const now = new Date();

        return Object.values(vocabulary).filter((word) => {
          // Only include words with valid data
          if (!word || !word.word || !word.definition) return false;
          // Mastered words don't need review
          if (word.masteryLevel >= 80) return false;
          // Words with scheduled review time - check if it's time
          if (word.nextReview) return new Date(word.nextReview) <= now;
          // New words (no schedule) can be reviewed
          return true;
        });
      },

      getMasteredWords: () => {
        const { vocabulary } = get();
        return Object.values(vocabulary).filter((word) => word.masteryLevel >= 80);
      },

      getLearningWords: () => {
        const { vocabulary } = get();
        return Object.values(vocabulary).filter(
          (word) => word.masteryLevel > 0 && word.masteryLevel < 80
        );
      },
    }),
    {
      name: 'stargirl-vocabulary',
    }
  )
);
