import type { Survey, SurveyQuestion, LeaderboardEntry } from '../types';

// Quiz backend API URL
// In production (Docker), API requests go through nginx proxy to '/api'
// In development, use VITE_QUIZ_API_URL or fallback to localhost:5005
const API_BASE_URL = import.meta.env.VITE_QUIZ_API_URL || '';

// Helper function for API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

// Survey APIs
export const surveyApi = {
  // Get all active surveys
  async getSurveys(): Promise<Survey[]> {
    try {
      const result = await apiRequest<{ success: boolean; data: Survey[] }>('/api/surveys');
      return result.data || [];
    } catch (error) {
      console.error('Failed to fetch surveys:', error);
      return [];
    }
  },

  // Get a specific survey by ID
  async getSurvey(surveyId: string): Promise<Survey | null> {
    try {
      const result = await apiRequest<{ success: boolean; data: Survey }>(
        `/api/surveys/${surveyId}`
      );
      return result.data || null;
    } catch (error) {
      console.error('Failed to fetch survey:', error);
      return null;
    }
  },

  // Get questions for a survey
  async getQuestions(surveyId: string): Promise<SurveyQuestion[]> {
    try {
      const result = await apiRequest<{ success: boolean; data: SurveyQuestion[] }>(
        `/api/surveys/${surveyId}/questions`
      );
      return result.data || [];
    } catch (error) {
      console.error('Failed to fetch questions:', error);
      return [];
    }
  },

  // Submit quiz answers
  async submitQuiz(submission: {
    survey_id: string;
    user_name: string;
    user_company?: string;
    user_phone?: string;
    answers: Array<{
      question_id: string;
      answer: string | string[];
    }>;
    time_taken_seconds?: number;
  }): Promise<{
    success: boolean;
    total_score: number;
    max_score: number;
    percentage: number;
    passed: boolean;
    results: Array<{
      question_id: string;
      is_correct: boolean;
      score: number;
      correct_answer: string | string[];
    }>;
  }> {
    try {
      const result = await apiRequest<{
        success: boolean;
        total_score: number;
        max_score: number;
        percentage: number;
        passed: boolean;
        results: Array<{
          question_id: string;
          is_correct: boolean;
          score: number;
          correct_answer: string | string[];
        }>;
      }>('/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify(submission),
      });
      return result;
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      throw error;
    }
  },

  // Get leaderboard for a survey
  async getLeaderboard(surveyId: string): Promise<LeaderboardEntry[]> {
    try {
      const result = await apiRequest<{
        success: boolean;
        data: { leaderboard: LeaderboardEntry[]; user_rank: LeaderboardEntry | null };
      }>(`/api/leaderboard/${surveyId}`);
      return result.data?.leaderboard || [];
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      return [];
    }
  },

  // Check if user has already attempted a survey
  async checkAttempt(surveyId: string, userName: string): Promise<{
    hasAttempted: boolean;
    attemptsRemaining: number;
    lastScore?: number;
  }> {
    try {
      const result = await apiRequest<{
        success: boolean;
        hasAttempted: boolean;
        attemptsRemaining: number;
        lastScore?: number;
      }>(`/api/surveys/${surveyId}/check-attempt?user_name=${encodeURIComponent(userName)}`);
      return {
        hasAttempted: result.hasAttempted || false,
        attemptsRemaining: result.attemptsRemaining ?? 1,
        lastScore: result.lastScore,
      };
    } catch (error) {
      console.error('Failed to check attempt:', error);
      return { hasAttempted: false, attemptsRemaining: 1 };
    }
  },
};

export default surveyApi;
