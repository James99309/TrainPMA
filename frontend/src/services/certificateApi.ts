/**
 * Certificate API Service
 * Handles fetching user certificates
 */
import type { Certificate } from '../types';
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
 * Get all certificates for the current user
 */
export async function getUserCertificates(): Promise<Certificate[]> {
  try {
    const token = getAuthToken();
    if (!token) {
      console.log('[CertificateApi] No auth token, skipping fetch');
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/api/certificates`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('[CertificateApi] Unauthorized, token may be expired');
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      return result.data as Certificate[];
    }

    return [];
  } catch (error) {
    console.error('[CertificateApi] Failed to fetch certificates:', error);
    return [];
  }
}

/**
 * Get certificate detail by ID (public access for sharing)
 */
export async function getCertificateById(certificateId: string): Promise<Certificate | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/certificates/${certificateId}`, {
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
      return result.data as Certificate;
    }

    return null;
  } catch (error) {
    console.error('[CertificateApi] Failed to fetch certificate:', error);
    return null;
  }
}

// Export as default object
const certificateApi = {
  getUserCertificates,
  getCertificateById,
};

export default certificateApi;
