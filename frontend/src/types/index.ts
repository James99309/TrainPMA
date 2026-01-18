// User Types
export type UserType = 'guest' | 'employee';

// Employee Info (for employee login)
export interface EmployeeInfo {
  employee_id: string;
  username: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  permissions?: string[];
}

// User Info (unified user data structure)
export interface UserInfo {
  // Basic info
  user_id: string;
  name: string;
  company: string;
  user_type: UserType;
  phone?: string;

  // Employee specific (optional)
  employee_info?: EmployeeInfo;

  // Auth info
  token?: string;
  remember_me?: boolean;

  // Guest invitation code access (客人通过邀请码获得的课程表访问权限)
  accessible_syllabi?: string[];

  // User progress (returned on login)
  progress?: UserProgress;

  // Future expansion reserved
  avatar_url?: string;
  email?: string;
  role?: string;
  custom_data?: Record<string, unknown>;
}

// Login Request Types
export interface GuestLoginRequest {
  login_type: 'guest';
  name: string;
  company: string;
  phone: string;
  remember_me?: boolean;
}

export interface EmployeeLoginRequest {
  login_type: 'employee';
  username: string;
  password: string;
  remember_me?: boolean;
}

export type LoginRequest = GuestLoginRequest | EmployeeLoginRequest;

// Login Response Types
export interface LoginResponse {
  success: boolean;
  data?: UserInfo;
  message?: string;
}

// User Progress
export interface UserProgress {
  streak: number;
  lastReadDate: string | null;
  totalXP: number;
  hearts: number;
  maxHearts: number;
  dailyGoalMinutes: number;
  currentChapter: number;
  currentSection: number;
  chaptersCompleted: number[];
  achievements: string[];
  wordsLearned: string[];
  onboardingCompleted: boolean;
  totalReadingTime: number; // Total reading time in seconds

  // 培训系统新增字段
  coursesCompleted: string[];  // 完成的课程ID列表
  quizzesPassed: number;       // 通过的测验次数
  quizStreak: number;          // 连续通过测验次数

  // XP 奖励系统字段
  lastLoginRewardDate: string | null;  // 上次领取登录奖励日期
  firstPassedQuizzes: string[];        // 首次通过的测验ID列表

  // 错题记录 (同步到服务器)
  wrongQuestions?: WrongQuestion[];
}

// Vocabulary Item
export interface VocabularyItem {
  word: string;
  definition: string;
  pronunciation: string;
  phonetic: string;
  partOfSpeech: string;
  contexts: VocabularyContext[];
  similarWords: string[];
  masteryLevel: number; // 0-100
  lastReviewed: string | null;
  nextReview: string | null;
  timesCorrect: number;
  timesIncorrect: number;
  isNew: boolean;
  isSaved: boolean;
}

export interface VocabularyContext {
  sentence: string;
  chapterId: number;
}

// Chapter Structure
export interface Section {
  id: number;
  paragraphs: string[];
  checkpointQuestion?: ComprehensionQuestion;
}

export interface Chapter {
  id: number;
  title: string;
  sections: Section[];
  vocabulary: VocabularyItem[];
}

// Quiz & Comprehension
export interface ComprehensionQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ReviewQuestion {
  id: string;
  type: 'fill_blank' | 'meaning' | 'context_match' | 'spelling';
  word: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  context: string;
}

// Achievements
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

// App State
export interface ReadingSession {
  startTime: number;
  currentChapter: number;
  currentSection: number;
  xpEarned: number;
  wordsViewed: string[];
}

// Leaderboard
export interface LeaderboardEntry {
  user_id: string;
  username: string;
  totalXP: number;
  level: number;
  rank: number;
}

// Course Icon Types
export type CourseIconType =
  | 'book' | 'lightbulb' | 'rocket' | 'star' | 'trophy'
  | 'chat' | 'code' | 'chart' | 'gear' | 'shield'
  | 'heart' | 'flag' | 'target' | 'puzzle' | 'graduation';

// Course System Types
export interface Course {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'ppt' | 'text';
  mediaUrl?: string;
  content?: string; // For text type
  thumbnailUrl?: string;
  totalPages?: number;
  duration_minutes?: number;
  slides?: PPTSlide[]; // For PPT type
  quiz?: CourseQuiz;
  order: number;
  isLocked?: boolean;
  tags?: string[]; // 标签数组，如 ["产品", "入门", "必修"]
  icon?: CourseIconType; // 课程图标类型
}

export interface PPTSlide {
  page: number;
  text?: string;
  imageUrl: string;
}

export interface CourseQuiz {
  survey_id: string;
  pass_score: number;
}

// Survey System Types
export interface Survey {
  survey_id: string;
  title: string;
  description: string;
  study_content_html: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  total_questions: number;
  pass_score: number;
  max_attempts: number;
  is_active: string; // 'TRUE' or 'FALSE'
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  question_type: 'single_choice' | 'multiple_choice' | 'fill_blank';
  question_text: string;
  options?: string[];
  correct_answer: string | string[];
  score: number;
  explanation?: string;
  order: number;
}

export interface SurveyAnswer {
  question_id: string;
  answer: string | string[];
  is_correct?: boolean;
  score?: number;
}

export interface SurveySubmission {
  survey_id: string;
  user_name: string;
  user_company?: string;
  user_phone?: string;
  answers: SurveyAnswer[];
  total_score: number;
  max_score: number;
  percentage: number;
  submitted_at: string;
}

export interface CourseProgress {
  courseId: string;
  currentPage: number;
  totalPages: number;
  isCompleted: boolean;
  completedAt?: string;
  quizPassed?: boolean;
  quizScore?: number;
}

// Progress Sync Types
export interface ProgressSyncRequest {
  clientProgress: UserProgress;
  lastSyncTime?: string;
}

export interface ProgressSyncResponse {
  success: boolean;
  data?: UserProgress;
  syncTime?: string;
  message?: string;
}

export interface ProgressApiResponse {
  success: boolean;
  data?: UserProgress;
  message?: string;
}

// 错题本类型
export interface WrongQuestion {
  id: string;                                    // 唯一ID (surveyId_questionId)
  surveyId: string;                              // 所属测验ID
  courseId?: string;                             // 所属课程ID
  courseName?: string;                           // 课程名称
  questionText: string;                          // 题目内容
  questionType: 'single_choice' | 'multiple_choice' | 'fill_blank';
  options?: string[];                            // 选项
  userAnswer: string | string[];                 // 用户答案
  correctAnswer: string | string[];              // 正确答案
  explanation?: string;                          // 解析
  score: number;                                 // 题目分值
  wrongCount: number;                            // 答错次数
  lastWrongAt: string;                           // 最近答错时间
  isResolved: boolean;                           // 是否已掌握
}

// 课程表项类型
export interface SyllabusItem {
  course_id: string;
  order: number;
  is_optional?: boolean;
}

// 客人邀请码类型
export interface GuestInvitation {
  enabled: boolean;
  code: string;
  expires_at: string | null;
  created_at: string;
  max_uses: number | null;
  current_uses: number;
  is_expired?: boolean;
  is_exhausted?: boolean;
}

// 访问规则类型
export interface AccessRules {
  allow_guests: boolean;
  allow_employees: boolean;
  allowed_user_groups: string[];
  allowed_users: string[];
  guest_invitation?: GuestInvitation;
}

// 邀请码验证结果类型
export interface InvitationCodeValidation {
  syllabus_id: string;
  syllabus_name: string;
  syllabus_description?: string;
}

// 时间配置类型
export interface TimeConfig {
  type: 'permanent' | 'limited';
  start_date?: string | null;
  end_date?: string | null;
}

// 课程表类型
export interface Syllabus {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  course_sequence: SyllabusItem[];
  access_type: 'public' | 'restricted';
  access_rules: AccessRules;
  time_config: TimeConfig;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// 用户组类型
export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  member_ids: string[];
  created_at: string;
  updated_at?: string;
}

// 用户简要信息类型 (用于搜索结果)
export interface UserBasicInfo {
  user_id: string;
  name: string;
  company?: string;
  phone?: string;
  created_at?: string;
}

// 课程表进度类型
export interface SyllabusProgress {
  syllabusId: string;
  completedCourses: string[];
  currentCourseId?: string;
  startedAt?: string;
  lastAccessedAt?: string;
}

// 扩展 Course 类型以支持标签和前置课程
export interface CourseExtended extends Course {
  prerequisites?: string[];
  is_published?: boolean;
  order_in_syllabus?: number;
  is_optional?: boolean;
  icon?: CourseIconType; // 课程图标 (继承自 Course)
}
