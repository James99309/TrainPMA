import type { Course, Survey, Syllabus, UserGroup, UserBasicInfo, CourseIconType, GuestInvitation } from '../types';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_QUIZ_API_URL || '';

// Admin API Key (stored in localStorage after login)
const getApiKey = (): string => {
  return localStorage.getItem('admin_api_key') || '';
};

// Helper function for admin API requests
async function adminRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const apiKey = getApiKey();

  console.log(`[adminRequest] ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-API-Key': apiKey,
      ...options.headers,
    },
  });

  console.log(`[adminRequest] 响应状态: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[adminRequest] 错误响应:`, errorText);
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { message: errorText || 'Unknown error' };
    }
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

// Question parsed from Excel
export interface ParsedQuestion {
  question_type: 'single_choice' | 'multiple_choice';
  question_text: string;
  options: string[];
  correct_answer: string | string[];
  score: number;
  explanation: string;
}

// Quiz import summary
export interface ImportSummary {
  total: number;
  single_choice: number;
  multiple_choice: number;
  total_score: number;
}

// Admin API
export const adminApi = {
  // ==================== Authentication ====================

  // Verify API key
  async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const url = `${API_BASE_URL}/api/admin/courses`;
      console.log('=== 验证 API Key ===');
      console.log('API_BASE_URL:', API_BASE_URL);
      console.log('完整 URL:', url);
      console.log('API Key:', apiKey.substring(0, 20) + '...');

      const response = await fetch(url, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      console.log('响应状态:', response.status);
      console.log('响应 OK:', response.ok);

      if (!response.ok) {
        const text = await response.text();
        console.log('错误响应:', text);
      }

      return response.ok;
    } catch (err) {
      console.error('验证异常:', err);
      return false;
    }
  },

  // Save API key
  saveApiKey(apiKey: string): void {
    localStorage.setItem('admin_api_key', apiKey);
  },

  // Clear API key
  logout(): void {
    localStorage.removeItem('admin_api_key');
  },

  // Check if logged in
  isLoggedIn(): boolean {
    return !!getApiKey();
  },

  // ==================== Course Management ====================

  // Get all courses
  async getCourses(): Promise<Course[]> {
    const result = await adminRequest<{ success: boolean; data: Course[] }>(
      '/api/admin/courses'
    );
    return result.data || [];
  },

  // Get single course
  async getCourse(courseId: string): Promise<Course | null> {
    try {
      const result = await adminRequest<{ success: boolean; data: Course }>(
        `/api/admin/courses/${courseId}`
      );
      return result.data || null;
    } catch {
      return null;
    }
  },

  // Create course (upload PDF)
  async createCourse(
    title: string,
    description: string,
    pdfFile: File,
    quizSurveyId?: string,
    passScore?: number,
    tags?: string[],
    icon?: CourseIconType
  ): Promise<Course> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('pdf', pdfFile);
    if (quizSurveyId) {
      formData.append('quiz_survey_id', quizSurveyId);
    }
    if (passScore !== undefined) {
      formData.append('pass_score', passScore.toString());
    }
    if (tags && tags.length > 0) {
      formData.append('tags', JSON.stringify(tags));
    }
    if (icon) {
      formData.append('icon', icon);
    }

    const result = await adminRequest<{ success: boolean; data: Course }>(
      '/api/admin/courses',
      {
        method: 'POST',
        body: formData,
      }
    );
    return result.data;
  },

  // Update course
  async updateCourse(
    courseId: string,
    updates: Partial<Course>
  ): Promise<Course> {
    const result = await adminRequest<{ success: boolean; data: Course }>(
      `/api/admin/courses/${courseId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );
    return result.data;
  },

  // Delete course
  async deleteCourse(courseId: string): Promise<void> {
    await adminRequest<{ success: boolean }>(
      `/api/admin/courses/${courseId}`,
      {
        method: 'DELETE',
      }
    );
  },

  // Reorder courses
  async reorderCourses(courseIds: string[]): Promise<void> {
    await adminRequest<{ success: boolean }>('/api/admin/courses/reorder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ course_ids: courseIds }),
    });
  },

  // Link quiz to course
  async linkQuiz(
    courseId: string,
    surveyId: string,
    passScore: number = 60
  ): Promise<Course> {
    const result = await adminRequest<{ success: boolean; data: Course }>(
      `/api/admin/courses/${courseId}/link-quiz`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ survey_id: surveyId, pass_score: passScore }),
      }
    );
    return result.data;
  },

  // ==================== Survey Management ====================

  // Get all surveys
  async getSurveys(): Promise<Survey[]> {
    const result = await adminRequest<{ success: boolean; data: Survey[] }>(
      '/api/admin/surveys'
    );
    return result.data || [];
  },

  // Create survey
  async createSurvey(survey: {
    title: string;
    description?: string;
    study_content_html?: string;
    start_time: string;
    end_time: string;
    duration_minutes?: number;
    total_questions?: number;
    pass_score?: number;
    max_attempts?: number;
  }): Promise<string> {
    const result = await adminRequest<{ success: boolean; data: { survey_id: string } }>(
      '/api/admin/surveys',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(survey),
      }
    );
    return result.data.survey_id;
  },

  // Update survey
  async updateSurvey(
    surveyId: string,
    survey: {
      title: string;
      description?: string;
      study_content_html?: string;
      start_time: string;
      end_time: string;
      duration_minutes?: number;
      total_questions?: number;
      pass_score?: number;
      max_attempts?: number;
    }
  ): Promise<void> {
    await adminRequest<{ success: boolean }>(
      `/api/admin/surveys/${surveyId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(survey),
      }
    );
  },

  // Delete survey
  async deleteSurvey(surveyId: string): Promise<void> {
    if (!surveyId) {
      throw new Error('考卷 ID 不能为空');
    }
    try {
      await adminRequest<{ success: boolean }>(
        `/api/admin/surveys/${surveyId}`,
        {
          method: 'DELETE',
        }
      );
    } catch (err: any) {
      // Re-throw with more context
      if (err.message?.includes('Failed to fetch') || err.message?.includes('Load failed')) {
        throw new Error('网络错误：无法连接到服务器，请检查后端服务是否运行');
      }
      throw err;
    }
  },

  // Parse Excel file (legacy endpoint)
  async parseExcelLegacy(
    excelFile: File
  ): Promise<{ questions: ParsedQuestion[] }> {
    const formData = new FormData();
    formData.append('file', excelFile);

    const result = await adminRequest<{
      success: boolean;
      data: { questions: ParsedQuestion[] };
    }>('/api/admin/parse-excel', {
      method: 'POST',
      body: formData,
    });

    return result.data;
  },

  // Add questions to survey
  async addQuestions(
    surveyId: string,
    questions: ParsedQuestion[]
  ): Promise<number> {
    const result = await adminRequest<{ success: boolean; data: { added_count: number } }>(
      '/api/admin/questions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ survey_id: surveyId, questions }),
      }
    );
    return result.data.added_count;
  },

  // ==================== Excel Quiz Import ====================

  // Parse Excel file (preview)
  async parseExcel(
    excelFile: File
  ): Promise<{ questions: ParsedQuestion[]; summary: ImportSummary }> {
    const formData = new FormData();
    formData.append('excel', excelFile);

    // 调试信息
    console.log('=== parseExcel 调试 ===');
    console.log('文件名:', excelFile.name);
    console.log('文件大小:', excelFile.size);
    console.log('文件类型:', excelFile.type);
    console.log('FormData entries:', [...formData.entries()]);

    try {
      const result = await adminRequest<{
        success: boolean;
        data: {
          questions: ParsedQuestion[];
          summary: ImportSummary;
        };
      }>('/api/admin/import-quiz', {
        method: 'POST',
        body: formData,
      });

      console.log('解析成功:', result);
      return result.data;
    } catch (err) {
      console.error('解析失败:', err);
      throw err;
    }
  },

  // Confirm import (add questions to survey)
  async confirmImport(
    surveyId: string,
    questions: ParsedQuestion[]
  ): Promise<number> {
    const result = await adminRequest<{
      success: boolean;
      data: { added_count: number };
    }>('/api/admin/import-quiz/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ survey_id: surveyId, questions }),
    });

    return result.data.added_count;
  },

  // Download template URL
  getTemplateUrl(): string {
    return `${API_BASE_URL}/api/admin/quiz-template`;
  },

  // ==================== Syllabus Management ====================

  // Get all syllabi
  async getSyllabi(): Promise<Syllabus[]> {
    const result = await adminRequest<{ success: boolean; data: Syllabus[] }>(
      '/api/admin/syllabi'
    );
    return result.data || [];
  },

  // Get single syllabus
  async getSyllabus(syllabusId: string): Promise<Syllabus | null> {
    try {
      const result = await adminRequest<{ success: boolean; data: Syllabus }>(
        `/api/admin/syllabi/${syllabusId}`
      );
      return result.data || null;
    } catch {
      return null;
    }
  },

  // Create syllabus
  async createSyllabus(syllabus: {
    name: string;
    description?: string;
    cover_image_url?: string;
  }): Promise<Syllabus> {
    const result = await adminRequest<{ success: boolean; data: Syllabus }>(
      '/api/admin/syllabi',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(syllabus),
      }
    );
    return result.data;
  },

  // Update syllabus
  async updateSyllabus(
    syllabusId: string,
    updates: Partial<Syllabus>
  ): Promise<Syllabus> {
    const result = await adminRequest<{ success: boolean; data: Syllabus }>(
      `/api/admin/syllabi/${syllabusId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );
    return result.data;
  },

  // Delete syllabus
  async deleteSyllabus(syllabusId: string): Promise<void> {
    await adminRequest<{ success: boolean }>(
      `/api/admin/syllabi/${syllabusId}`,
      {
        method: 'DELETE',
      }
    );
  },

  // Publish syllabus
  async publishSyllabus(syllabusId: string): Promise<Syllabus> {
    const result = await adminRequest<{ success: boolean; data: Syllabus }>(
      `/api/admin/syllabi/${syllabusId}/publish`,
      {
        method: 'POST',
      }
    );
    return result.data;
  },

  // Unpublish syllabus
  async unpublishSyllabus(syllabusId: string): Promise<Syllabus> {
    const result = await adminRequest<{ success: boolean; data: Syllabus }>(
      `/api/admin/syllabi/${syllabusId}/unpublish`,
      {
        method: 'POST',
      }
    );
    return result.data;
  },

  // Add course to syllabus
  async addCourseToSyllabus(
    syllabusId: string,
    courseId: string,
    isOptional?: boolean
  ): Promise<Syllabus> {
    const result = await adminRequest<{ success: boolean; data: Syllabus }>(
      `/api/admin/syllabi/${syllabusId}/courses`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ course_id: courseId, is_optional: isOptional }),
      }
    );
    return result.data;
  },

  // Remove course from syllabus
  async removeCourseFromSyllabus(
    syllabusId: string,
    courseId: string
  ): Promise<Syllabus> {
    const result = await adminRequest<{ success: boolean; data: Syllabus }>(
      `/api/admin/syllabi/${syllabusId}/courses/${courseId}`,
      {
        method: 'DELETE',
      }
    );
    return result.data;
  },

  // Reorder courses in syllabus
  async reorderCoursesInSyllabus(
    syllabusId: string,
    courseIds: string[]
  ): Promise<Syllabus> {
    const result = await adminRequest<{ success: boolean; data: Syllabus }>(
      `/api/admin/syllabi/${syllabusId}/courses/reorder`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ course_ids: courseIds }),
      }
    );
    return result.data;
  },

  // ==================== Invitation Code Management ====================

  // Generate invitation code
  async generateInvitationCode(
    syllabusId: string,
    options?: {
      expires_at?: string;
      max_uses?: number;
      custom_code?: string;
    }
  ): Promise<GuestInvitation> {
    const result = await adminRequest<{ success: boolean; data: GuestInvitation }>(
      `/api/admin/syllabi/${syllabusId}/invitation-code`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options || {}),
      }
    );
    return result.data;
  },

  // Get invitation code info
  async getInvitationCode(syllabusId: string): Promise<GuestInvitation | null> {
    const result = await adminRequest<{ success: boolean; data: GuestInvitation | null }>(
      `/api/admin/syllabi/${syllabusId}/invitation-code`
    );
    return result.data;
  },

  // Delete invitation code
  async deleteInvitationCode(syllabusId: string): Promise<void> {
    await adminRequest<{ success: boolean }>(
      `/api/admin/syllabi/${syllabusId}/invitation-code`,
      {
        method: 'DELETE',
      }
    );
  },

  // ==================== User Group Management ====================

  // Get all user groups
  async getUserGroups(): Promise<UserGroup[]> {
    const result = await adminRequest<{ success: boolean; data: UserGroup[] }>(
      '/api/admin/user-groups'
    );
    return result.data || [];
  },

  // Get single user group
  async getUserGroup(groupId: string): Promise<UserGroup | null> {
    try {
      const result = await adminRequest<{ success: boolean; data: UserGroup }>(
        `/api/admin/user-groups/${groupId}`
      );
      return result.data || null;
    } catch {
      return null;
    }
  },

  // Create user group
  async createUserGroup(group: {
    name: string;
    description?: string;
  }): Promise<UserGroup> {
    const result = await adminRequest<{ success: boolean; data: UserGroup }>(
      '/api/admin/user-groups',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(group),
      }
    );
    return result.data;
  },

  // Update user group
  async updateUserGroup(
    groupId: string,
    updates: Partial<UserGroup>
  ): Promise<UserGroup> {
    const result = await adminRequest<{ success: boolean; data: UserGroup }>(
      `/api/admin/user-groups/${groupId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );
    return result.data;
  },

  // Delete user group
  async deleteUserGroup(groupId: string): Promise<void> {
    await adminRequest<{ success: boolean }>(
      `/api/admin/user-groups/${groupId}`,
      {
        method: 'DELETE',
      }
    );
  },

  // Add member to group
  async addMemberToGroup(groupId: string, userId: string): Promise<UserGroup> {
    const result = await adminRequest<{ success: boolean; data: UserGroup }>(
      `/api/admin/user-groups/${groupId}/members`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );
    return result.data;
  },

  // Add multiple members to group
  async addMembersToGroup(groupId: string, userIds: string[]): Promise<UserGroup> {
    const result = await adminRequest<{ success: boolean; data: UserGroup }>(
      `/api/admin/user-groups/${groupId}/members`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      }
    );
    return result.data;
  },

  // Remove member from group
  async removeMemberFromGroup(groupId: string, userId: string): Promise<UserGroup> {
    const result = await adminRequest<{ success: boolean; data: UserGroup }>(
      `/api/admin/user-groups/${groupId}/members/${userId}`,
      {
        method: 'DELETE',
      }
    );
    return result.data;
  },

  // Search users
  async searchUsers(query: string, limit?: number): Promise<UserBasicInfo[]> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.append('limit', limit.toString());

    const result = await adminRequest<{ success: boolean; data: UserBasicInfo[] }>(
      `/api/admin/users/search?${params.toString()}`
    );
    return result.data || [];
  },

  // Get all users
  async getAllUsers(limit?: number, offset?: number): Promise<UserBasicInfo[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const result = await adminRequest<{ success: boolean; data: UserBasicInfo[] }>(
      `/api/admin/users/all?${params.toString()}`
    );
    return result.data || [];
  },

  // ==================== Certificate Management ====================

  // Issue certificates for a syllabus
  async issueCertificates(
    syllabusId: string,
    issuedBy?: string
  ): Promise<{
    certificates_issued: number;
    total_participants: number;
    skipped: number;
    not_passed: number;
  }> {
    const result = await adminRequest<{
      success: boolean;
      certificates_issued: number;
      total_participants: number;
      skipped: number;
      not_passed: number;
    }>(`/api/admin/certificates/issue/${syllabusId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ issued_by: issuedBy || 'admin' }),
    });
    return {
      certificates_issued: result.certificates_issued,
      total_participants: result.total_participants,
      skipped: result.skipped,
      not_passed: result.not_passed || 0,
    };
  },

  // ==================== Learning Analytics ====================

  // Get syllabi list for analytics tabs
  async getAnalyticsSyllabi(): Promise<{ id: string; name: string }[]> {
    const result = await adminRequest<{ success: boolean; data: { id: string; name: string }[] }>(
      '/api/admin/learning-analytics/syllabi'
    );
    return result.data || [];
  },

  // Get learning analytics data
  async getLearningAnalytics(syllabusId?: string): Promise<any> {
    const params = syllabusId ? `?syllabus_id=${syllabusId}` : '';
    const result = await adminRequest<{ success: boolean; data: any }>(
      `/api/admin/learning-analytics${params}`
    );
    return result.data;
  },
};

export default adminApi;
