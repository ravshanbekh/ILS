export interface ObservationCriterion { id: string; label: string }
export interface ObservationSection { id: string; title: string; items: ObservationCriterion[] }
export interface ObservationTeacher {
  id: string;
  fullName: string;
  role: string;
  teacherGroups: { id: string; name: string }[];
}
export interface ObservationRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  observerName: string;
  groupName: string;
  topic: string;
  studentsEnrolled: number;
  studentsPresent: number;
  scores: (ObservationCriterion & { score: number; sectionId: string; sectionTitle: string })[];
  totalScore: number;
  childrenAnswer: string | null;
  strengths: string;
  improvements: string;
  createdAt: string;
}
export interface ObservationList {
  items: ObservationRecord[];
  total: number;
  page: number;
  pageSize: number;
  averageScore: number | null;
}
export interface ObservationRank {
  teacherId: string;
  teacherName: string;
  count: number;
  averageScore: number;
  percentage: number;
  lastObservedAt: string;
  rank: number;
}
export interface ObservationFilters {
  teacherId?: string;
  from?: string;
  to?: string;
  page?: number;
}
export interface CreateObservation {
  teacherId: string;
  groupId?: string;
  groupName: string;
  topic: string;
  studentsEnrolled: number;
  studentsPresent: number;
  childrenAnswer?: string;
  strengths: string;
  improvements: string;
  ratings: Record<string, number>;
}

export const observationTime = (iso: string) => new Intl.DateTimeFormat('uz-UZ', {
  timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(iso));
