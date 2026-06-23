// ============ TELEGRAM BOT TYPES ============

export interface BotUserState {
  step?: string;           // 'await_login' | 'await_password' | 'await_feedback' | 'operator_await_login' | 'operator_await_password'
  pendingLogin?: string;   // Vaqtincha saqlanadigan login
  pendingOperatorLogin?: string;
}

export interface LinkedStudent {
  id: string;
  fullName: string;
  login: string;
  role: string;
  avatarUrl: string | null;
  groupStudents: Array<{
    group: { id: string; name: string };
  }>;
}

export interface StudentStats {
  student: {
    id: string;
    fullName: string;
    login: string;
  };
  totalScore: number;
  completed: number;
  pending: number;
  level: number;
  badges: Array<{ id: string; name: string; desc?: string }>;
  groups: Array<{
    group: { id: string; name: string };
    rank: number;
    totalInGroup: number;
  }>;
  submissions: Array<{
    id: string;
    normativeId: string;
    status: string;
    result: string | null;
    score: number;
    comment?: string | null;
    submittedAt: Date;
    normative: {
      taskNumber: number;
      title: string;
      maxScore: number;
    };
  }>;
}

export interface FreezeItem {
  id: string;
  studentName: string;
  teacherName: string | null;
  groupName: string | null;
  filial: string | null;
  phone: string | null;
  reason: string;
  detailedNote: string | null;
  frozenAt: Date;
  startDate: Date | null;
}

export interface TelegramLinkRecord {
  id: string;
  telegramId: bigint;
  chatId: bigint;
  studentId: string;
  role: string;
  fullName: string | null;
  username: string | null;
  isActive: boolean;
  language: string;
  notifyOnCheck: boolean;
  notifyOnRank: boolean;
  notifyWeekly: boolean;
  notifyInactivity: boolean;
  student: LinkedStudent;
}

export interface NotifyCheckPayload {
  studentId: string;
  normativeTaskNumber: number;
  normativeTitle: string;
  result: 'green' | 'blue' | 'red';
  score: number;
  comment?: string | null;
  totalScore?: number;
}

export interface NotifyRankPayload {
  studentId: string;
  groupName: string;
  oldGroupRank?: number;
  newGroupRank?: number;
  oldOverallRank?: number;
  newOverallRank?: number;
}

export interface NotifyFreezePayload {
  id: string;
  studentName: string;
  teacherName: string | null;
  groupName: string | null;
  reason: string;
  phone: string | null;
}
