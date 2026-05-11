import { UserRole, SubmissionStatus, SubmissionResult } from '@prisma/client';
import { Prisma } from '@prisma/client';

// ============ REQUEST TYPES ============

export interface AuthenticatedRequest {
  userId: string;
  role: UserRole;
  login: string;
}

// ============ FILTER TYPES ============

export interface UserFilters {
  role?: UserRole;
  search?: string;
}

export interface GroupFilters {
  teacherId?: string;
  search?: string;
}

export interface SubmissionFilters {
  groupId?: string;
  teacherId?: string;
}

// ============ RESPONSE TYPES ============

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface UserSummary {
  id: string;
  fullName: string;
  login: string;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface GroupSummary {
  id: string;
  name: string;
  teacher: { id: string; fullName: string } | null;
  studentsCount: number;
  normativesCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface SubmissionSummary {
  id: string;
  studentId: string;
  normativeId: string;
  groupId: string | null;
  youtubeUrl: string;
  status: SubmissionStatus;
  result: SubmissionResult | null;
  score: number;
  submittedAt: Date;
}

export interface RankEntry {
  rank: number;
  student: {
    id: string;
    fullName: string;
    login: string;
    avatarUrl: string | null;
  };
  totalScore: number;
  completed: number;
  results: {
    green: number;
    blue: number;
    red: number;
  };
}

// ============ PRISMA WHERE TYPES ============

export type UserWhereInput = Prisma.UserWhereInput;
export type GroupWhereInput = Prisma.GroupWhereInput;
export type SubmissionWhereInput = Prisma.SubmissionWhereInput;
export type NormativeWhereInput = Prisma.NormativeWhereInput;
