import api from './client';

export const authApi = {
  login: (data: { login: string; password: string }) =>
    api.post('/auth/login', data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get('/auth/me'),
};

export const usersApi = {
  getAll: (page: number = 1, limit: number = 100, role?: string, search?: string) =>
    api.get('/users', { params: { page, limit, role, search } }),

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
  }) => api.put('/settings/tutorial-videos', data),
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
