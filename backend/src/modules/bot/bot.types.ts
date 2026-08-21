// ============ TELEGRAM BOT TYPES ============

export interface BotUserState {
  step?: string;           // 'await_login' | 'await_password' | 'await_feedback' | 'await_ai_query' | 'admin_await_login' | 'admin_await_password' | 'await_appeal_message'
  pendingLogin?: string;   // Vaqtincha saqlanadigan login
  pendingAdminLogin?: string;
  pendingAppealType?: 'shikoyat' | 'taklif' | 'etiroz' | 'minnatdorchilik';
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
