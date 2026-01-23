/**
 * Badge API Service
 * Handles fetching user course badges
 */
import type { Badge } from '../types';
import { getAuthToken } from './progressApi';

const API_BASE_URL = import.meta.env.VITE_QUIZ_API_URL || '';

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
 * Get all badges for the current user
 */
export async function getUserBadges(): Promise<Badge[]> {
  try {
    const token = getAuthToken();
    if (!token) {
      console.log('[BadgeApi] No auth token, skipping fetch');
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/api/badges`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('[BadgeApi] Unauthorized, token may be expired');
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      return result.data as Badge[];
    }

    return [];
  } catch (error) {
    console.error('[BadgeApi] Failed to fetch badges:', error);
    return [];
  }
}

/**
 * Get badge detail by ID (public access for sharing)
 */
export async function getBadgeById(badgeId: string): Promise<Badge | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/badges/${badgeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      return result.data as Badge;
    }

    return null;
  } catch (error) {
    console.error('[BadgeApi] Failed to fetch badge:', error);
    return null;
  }
}

// Export as default object
const badgeApi = {
  getUserBadges,
  getBadgeById,
};

export default badgeApi;
