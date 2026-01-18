import type { LeaderboardEntry } from '../types';

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

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    // Use backend API instead of Google Apps Script
    const API_BASE = import.meta.env.VITE_QUIZ_API_URL || '';
    const response = await fetch(`${API_BASE}/api/progress/leaderboard`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return [];
  }
}
