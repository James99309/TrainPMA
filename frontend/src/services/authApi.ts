/**
 * Authentication API Service
 * Handles guest and employee login
 */
import type { UserInfo, LoginResponse, InvitationCodeValidation } from '../types';

// Invitation code validation response
interface InvitationCodeResponse {
  success: boolean;
  data?: InvitationCodeValidation;
  message?: string;
}

const API_BASE_URL = import.meta.env.VITE_QUIZ_API_URL || '';

// Local storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const USER_INFO_KEY = 'user_info';

/**
 * Validate invitation code
 */
export async function validateInvitationCode(
  code: string
): Promise<InvitationCodeResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/validate-invitation-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Validate invitation code error:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}

/**
 * Guest login - using name, company, and phone
 */
export async function guestLogin(
  name: string,
  company: string,
  phone: string,
  rememberMe: boolean = false,
  invitationCode?: string
): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login_type: 'guest',
        name,
        company,
        phone,
        remember_me: rememberMe,
        invitation_code: invitationCode || '',
      }),
    });

    const result = await response.json();

    if (result.success && result.data) {
      // Save to local storage if remember me is checked
      if (rememberMe) {
        saveAuthData(result.data);
      }
      return result;
    }

    return {
      success: false,
      message: result.message || '登录失败',
    };
  } catch (error) {
    console.error('Guest login error:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}

/**
 * Employee login - using username and password via PMA system
 */
export async function employeeLogin(
  username: string,
  password: string,
  rememberMe: boolean = false
): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login_type: 'employee',
        username,
        password,
        remember_me: rememberMe,
      }),
    });

    const result = await response.json();

    if (result.success && result.data) {
      // Save to local storage if remember me is checked
      if (rememberMe) {
        saveAuthData(result.data);
      }
      return result;
    }

    return {
      success: false,
      message: result.message || '账户或密码错误',
    };
  } catch (error) {
    console.error('Employee login error:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}

/**
 * Save auth data to local storage
 */
export function saveAuthData(userInfo: UserInfo): void {
  if (userInfo.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, userInfo.token);
  }
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
}

/**
 * Get saved auth data from local storage
 */
export function getSavedAuthData(): UserInfo | null {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userInfoStr = localStorage.getItem(USER_INFO_KEY);

    if (token && userInfoStr) {
      const userInfo = JSON.parse(userInfoStr) as UserInfo;
      return { ...userInfo, token };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Clear auth data from local storage
 */
export function clearAuthData(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
}

/**
 * Check if user is logged in (has valid saved session)
 */
export function isLoggedIn(): boolean {
  return getSavedAuthData() !== null;
}

/**
 * Logout - clear all auth data
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Ignore logout API errors
  } finally {
    clearAuthData();
  }
}

// Export as default object for convenience
const authApi = {
  validateInvitationCode,
  guestLogin,
  employeeLogin,
  saveAuthData,
  getSavedAuthData,
  clearAuthData,
  isLoggedIn,
  logout,
};

export default authApi;
