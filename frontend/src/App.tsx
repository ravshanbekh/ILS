import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { usePermissionStore } from '@/stores/permissionStore';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Login sahifasi darhol kerak — u lazy bo'lsa birinchi ochilishda "miltillash" bo'ladi
import LoginPage from '@/pages/auth/LoginPage';
import AIChatbot from '@/components/AIChatbot';
import { socket } from '@/utils/socket';
import { lazyWithReload } from '@/utils/lazyWithReload';
import { useEffect, Suspense } from 'react';

/**
 * Sahifalar talab bo'yicha (lazy) yuklanadi.
 *
 * Ilgari hamma sahifa bitta faylga yig'ilar edi: o'quvchi ham, kassir ham
 * kirishi bilan butun admin panel, grafiklar, Excel kutubxonasi va Live Quiz
 * kodini yuklab olardi. Endi har bir sahifa alohida bo'lak — foydalanuvchi
 * faqat o'zi ochgan sahifani yuklaydi.
 */
const AdminDashboard = lazyWithReload(() => import('@/pages/admin/DashboardPage'));
const DesignPreviewPage = lazyWithReload(() => import('@/pages/dev/DesignPreviewPage'));
const TeacherDashboard = lazyWithReload(() => import('@/pages/teacher/DashboardPage'));
const TeacherPendingPage = lazyWithReload(() => import('@/pages/teacher/PendingPage'));
const StudentDashboard = lazyWithReload(() => import('@/pages/student/DashboardPage'));
const StudentNormativesPage = lazyWithReload(() => import('@/pages/student/NormativesPage'));
const StudentHistoryPage = lazyWithReload(() => import('@/pages/student/HistoryPage'));
const StudentRankingPage = lazyWithReload(() => import('@/pages/student/RankingPage'));
const MyNormativesGuidePage = lazyWithReload(() => import('@/pages/student/MyNormativesGuidePage'));
const GroupDetailPage = lazyWithReload(() => import('@/pages/teacher/GroupDetailPage'));
const TeacherNormativesPage = lazyWithReload(() => import('@/pages/teacher/NormativesPage'));
const StudentProfilePage = lazyWithReload(() => import('@/pages/teacher/StudentProfilePage'));
const ExportPage = lazyWithReload(() => import('@/pages/shared/ExportPage'));
const UsersPage = lazyWithReload(() => import('@/pages/shared/UsersPage'));
const GroupsPage = lazyWithReload(() => import('@/pages/shared/GroupsPage'));
const NormativesPage = lazyWithReload(() => import('@/pages/shared/NormativesPage'));
const AdminSubmissionsPage = lazyWithReload(() => import('@/pages/admin/SubmissionsPage'));
const AdminStatsPage = lazyWithReload(() => import('@/pages/admin/StatsPage'));
const AdminRankingsPage = lazyWithReload(() => import('@/pages/admin/RankingsPage'));
const AdminSettingsPage = lazyWithReload(() => import('@/pages/admin/SettingsPage'));
const MonthlyReportPrintPage = lazyWithReload(() => import('@/pages/admin/MonthlyReportPrintPage'));
const ViewerDashboardPage = lazyWithReload(() => import('@/pages/viewer/DashboardPage'));
const FrozenStudentsPage = lazyWithReload(() => import('@/pages/shared/FrozenStudentsPage'));
const MonitoringPage = lazyWithReload(() => import('@/pages/shared/MonitoringPage'));
const TeacherRatingPage = lazyWithReload(() => import('@/pages/admin/TeacherRatingPage'));
const ChecklistStatsPage = lazyWithReload(() => import('@/pages/admin/ChecklistStatsPage'));
const ChecklistManagePage = lazyWithReload(() => import('@/pages/admin/ChecklistManagePage'));
const PredictionsPage = lazyWithReload(() => import('@/pages/admin/PredictionsPage'));
const ExamsPage = lazyWithReload(() => import('@/pages/teacher/ExamsPage'));
const LiveQuizPage = lazyWithReload(() => import('@/pages/teacher/LiveQuizPage'));
const ExamLobbyPage = lazyWithReload(() => import('@/pages/exam/ExamLobbyPage'));
const QuizJoinPage = lazyWithReload(() => import('@/pages/quiz/QuizJoinPage'));
const LessonsPage = lazyWithReload(() => import('@/pages/shared/LessonsPage'));
const TrashPage = lazyWithReload(() => import('@/pages/admin/TrashPage'));
const LessonControlPage = lazyWithReload(() => import('@/pages/admin/LessonControlPage'));
const ParentsPage = lazyWithReload(() => import('@/pages/admin/ParentsPage'));
const AppealsPage = lazyWithReload(() => import('@/pages/admin/AppealsPage'));
const EventFeedbackPage = lazyWithReload(() => import('@/pages/admin/EventFeedbackPage'));
const StudentCategoriesPage = lazyWithReload(() => import('@/pages/admin/StudentCategoriesPage'));
const ShopManagePage = lazyWithReload(() => import('@/pages/admin/ShopManagePage'));
const ShopOrdersPage = lazyWithReload(() => import('@/pages/shared/ShopOrdersPage'));
const CoinOversightPage = lazyWithReload(() => import('@/pages/shared/CoinOversightPage'));
const SupportBookingPage = lazyWithReload(() => import('@/pages/student/SupportBookingPage'));
const MySupportHoursPage = lazyWithReload(() => import('@/pages/shared/MySupportHoursPage'));
const SupportOversightPage = lazyWithReload(() => import('@/pages/shared/SupportOversightPage'));
const MyProfilePage = lazyWithReload(() => import('@/pages/shared/MyProfilePage'));
const HomeworkBankPage = lazyWithReload(() => import('@/pages/admin/HomeworkBankPage'));
const StudentHomeworkPage = lazyWithReload(() => import('@/pages/student/HomeworkPage'));
const StudentResultsPage = lazyWithReload(() => import('@/pages/student/ResultsPage'));
const StudentShopPage = lazyWithReload(() => import('@/pages/student/ShopPage'));
const PermissionsPage = lazyWithReload(() => import('@/pages/admin/PermissionsPage'));

/** Sahifa yuklanayotgan paytdagi ko'rsatkich */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
    </div>
  );
}


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

// Protected route component
function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    // Redirect to correct dashboard
    switch (user.role) {
      case 'admin': return <Navigate to="/admin" replace />;
      case 'teacher': return <Navigate to="/teacher" replace />;
      case 'student': return <Navigate to="/student" replace />;
      default: return <Navigate to={`/viewer/${user.role}`} replace />;
    }
  }

  return <>{children}</>;
}

// Redirect logged-in users to their dashboard
function AuthRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    switch (user.role) {
      case 'admin': return <Navigate to="/admin" replace />;
      case 'teacher': return <Navigate to="/teacher" replace />;
      case 'student': return <Navigate to="/student" replace />;
      default: return <Navigate to={`/viewer/${user.role}`} replace />;
    }
  }

  return <LoginPage />;
}

function GlobalSocket() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      socket.connect();
      socket.emit('join', user.id);
    } else {
      socket.disconnect();
    }

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, user]);

  return null;
}

/** Kirgan foydalanuvchining qo'lda berilgan ruxsatlarini yuklab qo'yadi */
function GlobalPermissions() {
  const { isAuthenticated, user } = useAuthStore();
  const fetchPermissions = usePermissionStore((s) => s.fetch);
  const resetPermissions = usePermissionStore((s) => s.reset);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchPermissions();
    } else {
      resetPermissions();
    }
  }, [isAuthenticated, user?.id, fetchPermissions, resetPermissions]);

  return null;
}

import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

export default function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GlobalSocket />
        <GlobalPermissions />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<AuthRedirect />} />

            {/* Dizayn qabul tekshiruvi uchun sahifa. FAQAT dev rejimida
                mavjud — `import.meta.env.DEV` production bundlega kirmaydi.
                Referens screenshotlar bilan yonma-yon solishtirish uchun. */}
            {import.meta.env.DEV && (
              <Route path="/__design" element={<DesignPreviewPage />} />
            )}

            {/* Special Print Routes (Without Layout) */}
            <Route
              path="/admin/export/monthly-pdf"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MonthlyReportPrintPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              element={
                <ProtectedRoute roles={['admin']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/groups" element={<GroupsPage />} />
              <Route path="/admin/groups/:id" element={<GroupDetailPage />} />
              <Route path="/admin/student/:id" element={<StudentProfilePage />} />
              <Route path="/admin/normatives" element={<NormativesPage />} />
              <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
              <Route path="/admin/stats" element={<AdminStatsPage />} />
              <Route path="/admin/rankings" element={<AdminRankingsPage />} />
              <Route path="/admin/frozen-students" element={<FrozenStudentsPage />} />
              <Route path="/admin/monitoring" element={<MonitoringPage />} />
              <Route path="/admin/teacher-rating" element={<TeacherRatingPage />} />
              <Route path="/admin/export" element={<ExportPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/checklist-stats" element={<ChecklistStatsPage />} />
              <Route path="/admin/checklist-manage" element={<ChecklistManagePage />} />
              <Route path="/admin/predictions" element={<PredictionsPage />} />
              <Route path="/admin/exams" element={<ExamsPage />} />
              <Route path="/admin/live-quiz" element={<LiveQuizPage />} />
              <Route path="/admin/lessons" element={<LessonsPage />} />
              <Route path="/admin/trash" element={<TrashPage />} />
              <Route path="/admin/permissions" element={<PermissionsPage />} />
              <Route path="/admin/lesson-control" element={<LessonControlPage />} />
              <Route path="/admin/parents" element={<ParentsPage />} />
              <Route path="/admin/student-categories" element={<StudentCategoriesPage />} />
              <Route path="/admin/shop-items" element={<ShopManagePage />} />
              <Route path="/admin/shop-orders" element={<ShopOrdersPage />} />
              <Route path="/admin/coin-oversight" element={<CoinOversightPage />} />
              <Route path="/admin/support-hours" element={<SupportOversightPage />} />
              <Route path="/admin/my-support-hours" element={<MySupportHoursPage />} />
              <Route path="/admin/profile" element={<MyProfilePage />} />
              <Route path="/admin/homework-bank" element={<HomeworkBankPage />} />
              <Route path="/admin/appeals" element={<AppealsPage />} />
              <Route path="/admin/event-feedback" element={<EventFeedbackPage />} />
            </Route>

            {/* Teacher routes */}
            <Route
              element={
                <ProtectedRoute roles={['teacher']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/teacher" element={<TeacherDashboard />} />
              <Route path="/teacher/profile" element={<MyProfilePage />} />
              <Route path="/teacher/users" element={<UsersPage />} />
              <Route path="/teacher/groups" element={<GroupsPage />} />
              <Route path="/teacher/groups/:id" element={<GroupDetailPage />} />
              <Route path="/teacher/student/:id" element={<StudentProfilePage />} />
              <Route path="/teacher/normatives" element={<TeacherNormativesPage />} />
              <Route path="/teacher/pending" element={<TeacherPendingPage />} />
              <Route path="/teacher/rankings" element={<StudentRankingPage />} />
              <Route path="/teacher/student-categories" element={<StudentCategoriesPage />} />
              <Route path="/teacher/export" element={<ExportPage />} />
              <Route path="/teacher/exams" element={<ExamsPage />} />
              <Route path="/teacher/live-quiz" element={<LiveQuizPage />} />
              <Route path="/teacher/lessons" element={<LessonsPage />} />
            </Route>

            {/* Public — Exam (no login needed for page, login via exam form) */}
            <Route path="/exam/:code" element={<ExamLobbyPage />} />

            {/* Public — Live Quiz player */}
            <Route path="/quiz/join" element={<QuizJoinPage />} />
            <Route path="/quiz/join/:code" element={<QuizJoinPage />} />


            {/* Student routes */}
            <Route
              element={
                <ProtectedRoute roles={['student']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/normatives" element={<StudentNormativesPage />} />
              <Route path="/student/history" element={<StudentHistoryPage />} />
              <Route path="/student/my-normatives" element={<MyNormativesGuidePage />} />
              <Route path="/student/ranking" element={<StudentRankingPage />} />
              <Route path="/student/shop" element={<StudentShopPage />} />
              <Route path="/student/support-hours" element={<SupportBookingPage />} />
              <Route path="/student/homework" element={<StudentHomeworkPage />} />
              <Route path="/student/results" element={<StudentResultsPage />} />
            </Route>

            {/* Viewer routes — all new roles */}
            <Route
              element={
                <ProtectedRoute roles={['filial_rahbari','assistant','moliya_rahbari','kassir','administrator','nazoratchi','hr_rahbari','sotuv_operatori','farrosh','robototexnika_ustoz','call_operatori']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/viewer/:role" element={<ViewerDashboardPage />} />
              <Route path="/viewer/:role/users" element={<UsersPage />} />
              <Route path="/viewer/:role/student/:id" element={<StudentProfilePage />} />
              <Route path="/viewer/:role/rankings" element={<StudentRankingPage />} />
              <Route path="/viewer/:role/frozen-students" element={<FrozenStudentsPage />} />
              <Route path="/viewer/:role/monitoring" element={<MonitoringPage />} />
              <Route path="/viewer/:role/teacher-rating" element={<TeacherRatingPage />} />
              <Route path="/viewer/:role/trash" element={<TrashPage />} />
              <Route path="/viewer/nazoratchi/checklist-stats" element={<ChecklistStatsPage />} />
              <Route path="/viewer/nazoratchi/checklist-manage" element={<ChecklistManagePage />} />
              <Route path="/viewer/:role/shop-orders" element={<ShopOrdersPage />} />
              <Route path="/viewer/:role/shop-items" element={<ShopManagePage />} />
              <Route path="/viewer/:role/coin-oversight" element={<CoinOversightPage />} />
              <Route path="/viewer/:role/my-support-hours" element={<MySupportHoursPage />} />
              <Route path="/viewer/:role/support-hours" element={<SupportOversightPage />} />
              <Route path="/viewer/:role/profile" element={<MyProfilePage />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>
          <AIChatbot />
        </BrowserRouter>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
