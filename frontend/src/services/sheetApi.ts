import type { LeaderboardResponse } from '../types';
import { getAuthToken } from './progressApi';

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyGkTtPzqfgbf5E1xGcmygYM_Fe1K4btoZUmgWLgwiVhFTD56PbvlwoABpbEqTyKWNn/exec';

export async function recordProgress(data: {
  username: string;
  chapter: string;
  score: string;
  xp: number;
}) {
  try {
    await fetch(SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    console.log('Progress recorded to Google Sheets');
  } catch (error) {
    console.error('Failed to record progress:', error);
  }
}

export interface LeaderboardOptions {
  type?: 'auto' | 'syllabus';
  syllabusId?: string;
}

export async function fetchLeaderboard(
  options: LeaderboardOptions = {}
): Promise<LeaderboardResponse | null> {
  try {
    const API_BASE = import.meta.env.VITE_QUIZ_API_URL || '';
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.syllabusId) params.append('syllabus_id', options.syllabusId);

    const token = getAuthToken();

    // 没有 token 时返回 null，前端会显示"请先登录"
    if (!token) {
      console.log('[Leaderboard] No auth token found');
      return null;
    }

    const response = await fetch(
      `${API_BASE}/api/progress/leaderboard?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.success && result.data) {
      return result.data as LeaderboardResponse;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return null;
  }
}
