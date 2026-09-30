import axios from 'axios';

/**
 * Ommaviy test uchun alohida axios.
 *
 * Asosiy `api` clientida 401 bo'lsa refresh-token oqimi ishga tushadi va
 * oxir-oqibat login sahifasiga uloqtiradi. Test ishtirokchisi esa tizimga
 * umuman kirmaydi — shuning uchun unga toza, interceptorsiz client kerak.
 */
const publicApi = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export interface PublicTestInfo {
  id: string;
  title: string;
  description: string | null;
  code: string;
  status: string;
  durationMin: number;
  startsAt: string | null;
  expiresAt: string | null;
  requirePhone: boolean;
  attemptsAllowed: number;
  showResult: boolean;
  passPercent: number | null;
  createdBy: { fullName: string } | null;
  blocked: string | null;
  questionCount: number;
  closedShown: number;
  openShown: number;
}

export interface PublicQuestion {
  id: string;
  type: 'closed' | 'open';
  text: string;
  imageUrl: string | null;
  points: number;
  options?: string[];
}

export const publicTestApi = {
  getTest: (code: string) => publicApi.get(`/quiz-tests/public/${code}`),

  start: (code: string, data: { fullName: string; phone?: string }) =>
    publicApi.post(`/quiz-tests/public/${code}/start`, data),

  resume: (token: string) => publicApi.get(`/quiz-tests/attempt/${token}`),

  saveAnswer: (
    token: string,
    data: { questionId: string; selected?: number[]; textAnswer?: string }
  ) => publicApi.post(`/quiz-tests/attempt/${token}/answer`, data),

  submit: (token: string) => publicApi.post(`/quiz-tests/attempt/${token}/submit`),

  getResult: (token: string) => publicApi.get(`/quiz-tests/attempt/${token}/result`),
};

/** Backend xatosi turli shaklda kelishi mumkin — bitta joyda normallashtiramiz. */
export function testErrMsg(e: any, fallback = 'Xatolik yuz berdi'): string {
  const err = e?.response?.data?.error;
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  if (e?.response?.data?.message) return e.response.data.message;
  return fallback;
}
