
export enum AppStep {
  LOGIN = 0,
  SELECTION = 1,
  TOPICS = 2,
  QUIZ = 3,
  RESULTS = 4,
  REPORTS = 5,
  ADMIN_LOGIN = 6,
  ADMIN_DASHBOARD = 7,
  TEACHER_DASHBOARD = 8,
  NOTIFICATIONS = 9,
  CHANGE_PASSWORD_REQUIRED = 10,
}

export enum ResourceType {
  QUIZ = 'اختبار',
  ASSIGNMENT = 'واجب منزلي',
  WORKSHEET = 'ورقة عمل',
}

export enum Semester {
  FIRST = 'الفصل الدراسي الأول',
  SECOND = 'الفصل الدراسي الثاني',
  THIRD = 'الفصل الدراسي الثالث',
}

export enum UserRole {
  STUDENT = 'طالب',
  TEACHER = 'معلم',
  ADMIN = 'مشرف نظام',
}

export interface Notification {
  id: string;
  sender: string;
  text: string;
  date: string;
}

export interface UserPermissions {
  canCreateTests: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  grade?: string;
  password?: string;
  mustChangePassword?: boolean;
  permissions: UserPermissions;
}

export interface AppConfig {
  minPassingScore: number;
  fontFamily: 'Cairo' | 'Tajawal' | 'Almarai';
  themeColor: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
  logoUrl?: string;
}

export interface UserState {
  name: string;
  grade: string;
  semester: Semester;
  subject: string;
  selectedTopic: string;
  quizCount: number;
}

export enum QuestionType {
  MCQ = 'MCQ',
  TF = 'TF',
  OPEN = 'OPEN', // For worksheets
}

export interface Question {
  id: number;
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswerIndex: number;
}

export interface QuizResult {
  score: number;
  total: number;
  answers: number[];
}

export interface QuizHistoryItem {
  id: string;
  date: string;
  studentName?: string;
  subject: string;
  topic: string;
  score: number;
  total: number;
  grade: string;
  type?: ResourceType;
}
