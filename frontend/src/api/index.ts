import api from './client';

export const authApi = {
  login: (data: { login: string; password: string }) =>
    api.post('/auth/login', data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get('/auth/me'),

  updateProfile: (data: { login?: string; currentPassword?: string; newPassword?: string }) =>
    api.patch('/auth/profile', data),
};

export const usersApi = {
  getAll: (page: number = 1, limit: number = 100, role?: string, search?: string) =>
    api.get('/users', { params: { page, limit, role, search } }),

  // Guruhsiz o'quvchilar (bug fix - pagination chegarasiz)
  getUngrouped: (search?: string) =>
    api.get('/users/ungrouped', { params: { search } }),

  // Teacher uchun tezkor endpoint — bitta DB query
  getMyStudents: (page: number = 1, limit: number = 100, search?: string) =>
    api.get('/users/my-students', { params: { page, limit, search } }),

  getById: (id: string) => api.get(`/users/${id}`),

  create: (data: any) => api.post('/users', data),

  bulkCreate: (data: { users: any[] }) => api.post('/users/bulk', data),

  update: (id: string, data: any) => api.put(`/users/${id}`, data),

  delete: (id: string) => api.delete(`/users/${id}`),
};

export const groupsApi = {
  getAll: (page: number = 1, limit: number = 100, search?: string, teacherId?: string) =>
    api.get('/groups', { params: { page, limit, search, teacherId } }),

  getById: (id: string) => api.get(`/groups/${id}`),

  create: (data: any) => api.post('/groups', data),

  update: (id: string, data: any) => api.put(`/groups/${id}`, data),

  delete: (id: string) => api.delete(`/groups/${id}`),

  addStudent: (groupId: string, studentId: string) =>
    api.post(`/groups/${groupId}/students`, { studentId }),

  addStudentsBulk: (groupId: string, studentIds: string[]) =>
    api.post(`/groups/${groupId}/students/bulk`, { studentIds }),

  removeStudent: (groupId: string, studentId: string) =>
    api.delete(`/groups/${groupId}/students/${studentId}`),

  assignNormatives: (groupId: string, normativeIds: string[]) =>
    api.post(`/groups/${groupId}/normatives`, { normativeIds }),
};

export const normativesApi = {
  getAll: (page: number = 1, limit: number = 100, search?: string) =>
    api.get('/normatives', { params: { page, limit, search } }),

  getById: (id: string) => api.get(`/normatives/${id}`),

  create: (data: any) => api.post('/normatives', data),

  update: (id: string, data: any) => api.put(`/normatives/${id}`, data),

  delete: (id: string) => api.delete(`/normatives/${id}`),
};

export const submissionsApi = {
  getPending: (params?: Record<string, string>) =>
    api.get('/submissions', { params }),

  getAll: (page: number = 1, limit: number = 200) =>
    api.get('/submissions/all', { params: { page, limit } }),

  getByStudent: (studentId: string, params?: Record<string, string>) =>
    api.get(`/submissions/student/${studentId}`, { params }),

  getById: (id: string) => api.get(`/submissions/${id}`),

  create: (data: any) => api.post('/submissions', data),

  check: (id: string, data: { result: string; comment?: string }) =>
    api.patch(`/submissions/${id}/check`, data),

  allowResubmit: (id: string) =>
    api.patch(`/submissions/${id}/allow-resubmit`),
};

export const statsApi = {
  getOverview: () => api.get('/stats/overview'),

  getTeachersRanking: () => api.get('/stats/teachers-ranking'),

  getTeacherStats: (teacherId?: string) =>
    api.get('/stats/teacher', { params: teacherId ? { teacherId } : {} }),

  getGroupStats: (groupId: string) =>
    api.get(`/stats/group/${groupId}`),

  getStudentStats: (studentId: string) =>
    api.get(`/stats/student/${studentId}`),

  // AI tahlil — o'quvchini normativlar bo'yicha AI bilan tahlil qilish
  analyzeStudentWithAI: (studentId: string) =>
    api.post(`/stats/student/${studentId}/ai-analyze`),
};

export const rankingsApi = {
  getOverall: (params?: Record<string, string | number>) =>
    api.get('/rankings/overall', { params }),

  getGroupRanking: (groupId: string) =>
    api.get(`/rankings/group/${groupId}`),
};

export const settingsApi = {
  getTutorialVideos: () =>
    api.get('/settings/tutorial-videos'),

  updateTutorialVideos: (data: {
    platformRules?: { youtubeUrl: string; title?: string; description?: string };
    normativeRules?: { youtubeUrl: string; title?: string; description?: string };
    obsStudio?: { youtubeUrl: string; title?: string; description?: string };
    youtubeChannel?: { youtubeUrl: string; title?: string; description?: string };
  }) => api.put('/settings/tutorial-videos', data),

  // Gemini AI sozlamalari
  getGeminiStatus: () => api.get('/settings/gemini'),
  updateGemini: (data: { apiKey?: string; model?: string; centerContext?: string }) => api.put('/settings/gemini', data),
  testGemini: () => api.post('/settings/gemini/test'),
};

export const freezesApi = {
  // Muzlatish (admin, administrator, sotuv_operatori, kassir)
  freeze: (data: {
    studentId: string;
    reason: string;
    detailedNote?: string;
    phone?: string;
    startDate?: string;
    filial?: string;
  }) => api.post('/freezes', data),

  // Ro'yxat (admin, filial_rahbari, kassir)
  getAll: (params?: {
    month?: number;
    year?: number;
    reason?: string;
    teacherName?: string;
    filial?: string;
    search?: string;
  }) => api.get('/freezes', { params }),

  // Hisobot (5 tab uchun ma'lumotlar)
  getReport: (month: number, year: number) =>
    api.get('/freezes/report', { params: { month, year } }),

  // O'qituvchilar reytingi
  getTeacherRating: (month: number, year: number) =>
    api.get('/freezes/teacher-rating', { params: { month, year } }),

  // Gemini AI tahlil
  analyzeWithAI: (month: number, year: number) =>
    api.post('/freezes/ai-analyze', { month, year }),

  // Operator gaplashish scriptini olish
  getOperatorScript: (id: string) =>
    api.post(`/freezes/${id}/script`),

  // Bekor qilish (admin only)
  unfreeze: (id: string) => api.delete(`/freezes/${id}`),
};

export const notificationsApi = {
  getAll: () => api.get('/notifications'),

  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),

  markAllAsRead: () => api.patch('/notifications/read-all'),
};

export const exportApi = {
  exportGroup: (groupId: string) =>
    api.get(`/export/group/${groupId}`, { responseType: 'blob' }),

  exportOverview: () =>
    api.get('/export/overview', { responseType: 'blob' }),

  exportMonthlyReport: () =>
    api.get('/export/monthly-report', { responseType: 'blob' }),

  exportStudent: (studentId: string) =>
    api.get(`/export/student/${studentId}`, { responseType: 'blob' }),
};

export const backupApi = {
  downloadBackup: () => api.get('/backup/download', { responseType: 'blob' }),
  restoreBackup: (data: any) => api.post('/backup/restore', data),
};

export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

export const checklistApi = {
  getToday: () => api.get('/checklist/today'),
  getDay: (date: string) => api.get('/checklist/day', { params: { date } }),
  getWeekly: () => api.get('/checklist/weekly'),
  toggle: (itemId: string) => api.post(`/checklist/${itemId}/toggle`),
};

export const monitoringApi = {
  // Guruhlar ro'yxati (rang indikatori bilan)
  getGroups: () => api.get('/monitoring/groups'),

  // Guruh dashboard — o'quvchilar + oxirgi fikrlar
  getGroupDashboard: (groupId: string) => api.get(`/monitoring/groups/${groupId}`),

  // Guruh qo'ng'iroqlar tarixi
  getGroupCalls: (groupId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/monitoring/groups/${groupId}/calls`, { params }),

  // O'quvchi timeline
  getStudentTimeline: (studentId: string) =>
    api.get(`/monitoring/students/${studentId}/timeline`),

  // Yangi qo'ng'iroq sessiyasi
  createCall: (data: { groupId: string; summary?: string; callDate?: string }) =>
    api.post('/monitoring/calls', data),

  // Qo'ng'iroqni o'chirish
  deleteCall: (callId: string) => api.delete(`/monitoring/calls/${callId}`),

  // Fikr qo'shish
  addNote: (callId: string, data: {
    studentId: string;
    mood: string;
    note: string;
    tags?: string[];
  }) => api.post(`/monitoring/calls/${callId}/notes`, data),

  // Fikr tahrirlash
  updateNote: (noteId: string, data: {
    mood?: string;
    note?: string;
    tags?: string[];
  }) => api.put(`/monitoring/notes/${noteId}`, data),

  // Fikr o'chirish
  deleteNote: (noteId: string) => api.delete(`/monitoring/notes/${noteId}`),

  // Guruh AI tahlil
  analyzeGroup: (groupId: string) =>
    api.post(`/monitoring/groups/${groupId}/ai-analyze`),

  // O'qituvchi AI tahlil
  analyzeTeacher: (teacherId: string) =>
    api.post(`/monitoring/teachers/${teacherId}/ai-analyze`),

  // O'quvchi bilan ishlash uchun AI script generatsiyasi
  generateStudentScript: (studentId: string) =>
    api.post(`/monitoring/students/${studentId}/script`),
};

export const chatbotApi = {
  ask: (message: string) => api.post('/chatbot/ask', { message }),
};

export const predictionsApi = {
  // Dropout xavfi bashorati (admin uchun)
  getDropout: () => api.get('/predictions/dropout'),

  // Revenue bashorati (admin uchun)
  getRevenue: () => api.get('/predictions/revenue'),
};

export const feedbackApi = {
  // O'quvchi feedback beradi
  create: (data: { message: string; type?: string }) => api.post('/feedback', data),

  // O'z feedbacklarini ko'rish
  getMy: () => api.get('/feedback/my'),

  // Admin: barcha feedbacklar
  getAll: () => api.get('/feedback'),

  // Admin: feedbackga javob berish
  reply: (id: string, reply: string) => api.patch(`/feedback/${id}/reply`, { reply }),

  // O'quvchi: o'zining AI tahlilini ko'rish
  getMyAiAnalysis: () => api.get('/feedback/ai-analysis'),
};

