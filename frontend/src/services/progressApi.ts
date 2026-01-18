/**
 * Progress Sync API Service
 * Handles user progress synchronization with the server
 */
import type { UserProgress } from '../types';

const API_BASE_URL = import.meta.env.VITE_QUIZ_API_URL || '';

// Local storage key for auth token
const AUTH_TOKEN_KEY = 'auth_token';

// In-memory token storage (for non-rememberMe case where token is only in Zustand store)
let inMemoryToken: string | null = null;

/**
 * Set auth token in memory (call this during login when rememberMe is not checked)
 * This allows progressApi to access the token without depending on courseStore
 */
export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  console.log('[ProgressSync] In-memory token set:', !!token);
}

/**
 * Clear auth token from memory (call this during logout)
 */
export function clearAuthToken(): void {
  inMemoryToken = null;
  console.log('[ProgressSync] In-memory token cleared');
}

/**
 * Get auth token from memory first, then fall back to local storage
 */
function getAuthToken(): string | null {
  // Check in-memory token first (set during login for non-rememberMe case)
  if (inMemoryToken) {
    return inMemoryToken;
  }
  // Fall back to localStorage (set during login with rememberMe checked)
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Create headers with authorization
 */
function createAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch user progress from server
 */
export async function fetchProgress(): Promise<UserProgress | null> {
  try {
    const token = getAuthToken();
    if (!token) {
      console.log('No auth token, skipping progress fetch');
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/api/progress`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('Unauthorized, token may be expired');
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      return result.data as UserProgress;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch progress:', error);
    return null;
  }
}

/**
 * Save user progress to server
 */
export async function saveProgress(progress: UserProgress): Promise<boolean> {
  console.log('[ProgressSync] Saving progress...', {
    totalXP: progress.totalXP,
    streak: progress.streak,
    chaptersCompleted: progress.chaptersCompleted,
    currentChapter: progress.currentChapter,
    currentSection: progress.currentSection,
    wrongQuestions: progress.wrongQuestions?.length || 0,
  });

  try {
    const token = getAuthToken();
    if (!token) {
      console.log('[ProgressSync] ❌ No auth token, skipping progress save');
      return false;
    }

    console.log('[ProgressSync] Making POST request to /api/progress...');
    const response = await fetch(`${API_BASE_URL}/api/progress`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(progress),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('[ProgressSync] ❌ Unauthorized (401), token may be expired');
        return false;
      }
      console.log('[ProgressSync] ❌ HTTP error:', response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success === true) {
      console.log('[ProgressSync] ✅ Progress saved successfully');
      return true;
    } else {
      console.log('[ProgressSync] ❌ Server returned success=false:', result);
      return false;
    }
  } catch (error) {
    console.error('[ProgressSync] ❌ Failed to save progress:', error);
    return false;
  }
}

/**
 * Sync progress with server (bi-directional)
 * Server is the single source of truth
 */
export async function syncProgress(
  clientProgress: UserProgress
): Promise<{ success: boolean; progress: UserProgress | null; syncTime: string | null }> {
  try {
    const token = getAuthToken();
    if (!token) {
      console.log('No auth token, skipping progress sync');
      return { success: false, progress: null, syncTime: null };
    }

    const response = await fetch(`${API_BASE_URL}/api/progress/sync`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify({
        clientProgress,
        lastSyncTime: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('Unauthorized, token may be expired');
        return { success: false, progress: null, syncTime: null };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      return {
        success: true,
        progress: result.data as UserProgress,
        syncTime: result.syncTime || null,
      };
    }

    return { success: false, progress: null, syncTime: null };
  } catch (error) {
    console.error('Failed to sync progress:', error);
    return { success: false, progress: null, syncTime: null };
  }
}

// Debounce helper for auto-sync
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 5000; // 5 seconds

/**
 * Debounced save - waits 5 seconds after last change before saving
 */
export function debouncedSaveProgress(progress: UserProgress): void {
  console.log('[ProgressSync] Debounced save scheduled (5s delay)...');

  if (syncTimeout) {
    console.log('[ProgressSync] Clearing previous pending sync');
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    console.log('[ProgressSync] Debounce timer fired, executing save...');
    saveProgress(progress);
    syncTimeout = null;
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Cancel any pending sync
 */
export function cancelPendingSync(): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
}

/**
 * Force immediate sync (for logout or beforeunload)
 * Returns a Promise that resolves when sync completes (or fails)
 * IMPORTANT: Caller should await this before clearing auth data
 * @param progress - The user progress data to sync
 * @param explicitToken - Optional token to use (useful when token is not in localStorage, e.g., "Remember Me" unchecked)
 */
export async function forceImmediateSync(progress: UserProgress, explicitToken?: string): Promise<boolean> {
  console.log('[ProgressSync] ========== FORCE SYNC DEBUG ==========');
  console.log('[ProgressSync] Force immediate sync called');
  console.log('[ProgressSync] Progress data to sync:', {
    hearts: progress.hearts,
    totalXP: progress.totalXP,
    streak: progress.streak,
    chaptersCompleted: progress.chaptersCompleted?.length || 0,
    wrongQuestions: progress.wrongQuestions?.length || 0,
  });

  cancelPendingSync();

  // Use explicit token if provided, otherwise fall back to localStorage
  const token = explicitToken || getAuthToken();
  console.log('[ProgressSync] Token source:', explicitToken ? 'explicit (from store)' : 'localStorage');
  console.log('[ProgressSync] Token exists:', !!token);
  console.log('[ProgressSync] Token value (first 20 chars):', token ? token.substring(0, 20) + '...' : 'null');

  if (!token) {
    console.log('[ProgressSync] ❌ No token for immediate sync - ABORTING');
    console.log('[ProgressSync] ========== FORCE SYNC DEBUG END ==========');
    return false;
  }

  // Use await to ensure sync completes before returning
  console.log('[ProgressSync] Attempting fetch with keepalive...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(progress),
      keepalive: true, // Allows request to outlive the page
    });

    console.log('[ProgressSync] Fetch response status:', response.status);
    const result = await response.json();
    console.log('[ProgressSync] Fetch result:', result);

    if (result.success) {
      console.log('[ProgressSync] ✅ Progress synced successfully');
      console.log('[ProgressSync] ========== FORCE SYNC DEBUG END ==========');
      return true;
    } else {
      console.log('[ProgressSync] ❌ Server returned success=false');
      console.log('[ProgressSync] ========== FORCE SYNC DEBUG END ==========');
      return false;
    }
  } catch (err) {
    console.log('[ProgressSync] ❌ Fetch failed:', err);
    // Fallback to sendBeacon (fire-and-forget, for page unload scenarios)
    console.log('[ProgressSync] Trying sendBeacon as fallback...');
    const blob = new Blob([JSON.stringify(progress)], { type: 'application/json' });
    const url = `${API_BASE_URL}/api/progress?token=${token}`;
    const beaconResult = navigator.sendBeacon(url, blob);
    console.log('[ProgressSync] sendBeacon result:', beaconResult ? '✅ queued' : '❌ failed');
    console.log('[ProgressSync] ========== FORCE SYNC DEBUG END ==========');
    return beaconResult;
  }
}

// Export as default object
const progressApi = {
  fetchProgress,
  saveProgress,
  syncProgress,
  debouncedSaveProgress,
  cancelPendingSync,
  forceImmediateSync,
  setAuthToken,
  clearAuthToken,
};

export default progressApi;
