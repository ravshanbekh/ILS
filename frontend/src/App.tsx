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
import { useEffect, lazy, Suspense } from 'react';

/**
 * Sahifalar talab bo'yicha (lazy) yuklanadi.
 *
 * Ilgari hamma sahifa bitta faylga yig'ilar edi: o'quvchi ham, kassir ham
 * kirishi bilan butun admin panel, grafiklar, Excel kutubxonasi va Live Quiz
 * kodini yuklab olardi. Endi har bir sahifa alohida bo'lak — foydalanuvchi
 * faqat o'zi ochgan sahifani yuklaydi.
 */
const AdminDashboard = lazy(() => import('@/pages/admin/DashboardPage'));
const TeacherDashboard = lazy(() => import('@/pages/teacher/DashboardPage'));
const TeacherPendingPage = lazy(() => import('@/pages/teacher/PendingPage'));
const StudentDashboard = lazy(() => import('@/pages/student/DashboardPage'));
const StudentNormativesPage = lazy(() => import('@/pages/student/NormativesPage'));
const StudentHistoryPage = lazy(() => import('@/pages/student/HistoryPage'));
const StudentRankingPage = lazy(() => import('@/pages/student/RankingPage'));
const MyNormativesGuidePage = lazy(() => import('@/pages/student/MyNormativesGuidePage'));
const GroupDetailPage = lazy(() => import('@/pages/teacher/GroupDetailPage'));
const TeacherNormativesPage = lazy(() => import('@/pages/teacher/NormativesPage'));
const StudentProfilePage = lazy(() => import('@/pages/teacher/StudentProfilePage'));
const ExportPage = lazy(() => import('@/pages/shared/ExportPage'));
const UsersPage = lazy(() => import('@/pages/shared/UsersPage'));
const GroupsPage = lazy(() => import('@/pages/shared/GroupsPage'));
const NormativesPage = lazy(() => import('@/pages/shared/NormativesPage'));
const AdminSubmissionsPage = lazy(() => import('@/pages/admin/SubmissionsPage'));
const AdminStatsPage = lazy(() => import('@/pages/admin/StatsPage'));
const AdminRankingsPage = lazy(() => import('@/pages/admin/RankingsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const MonthlyReportPrintPage = lazy(() => import('@/pages/admin/MonthlyReportPrintPage'));
const ViewerDashboardPage = lazy(() => import('@/pages/viewer/DashboardPage'));
const FrozenStudentsPage = lazy(() => import('@/pages/shared/FrozenStudentsPage'));
const MonitoringPage = lazy(() => import('@/pages/shared/MonitoringPage'));
const TeacherRatingPage = lazy(() => import('@/pages/admin/TeacherRatingPage'));
const ChecklistStatsPage = lazy(() => import('@/pages/admin/ChecklistStatsPage'));
const ChecklistManagePage = lazy(() => import('@/pages/admin/ChecklistManagePage'));
const PredictionsPage = lazy(() => import('@/pages/admin/PredictionsPage'));
const ExamsPage = lazy(() => import('@/pages/teacher/ExamsPage'));
const LiveQuizPage = lazy(() => import('@/pages/teacher/LiveQuizPage'));
const ExamLobbyPage = lazy(() => import('@/pages/exam/ExamLobbyPage'));
const QuizJoinPage = lazy(() => import('@/pages/quiz/QuizJoinPage'));
const LessonsPage = lazy(() => import('@/pages/shared/LessonsPage'));
const TrashPage = lazy(() => import('@/pages/admin/TrashPage'));
const LessonControlPage = lazy(() => import('@/pages/admin/LessonControlPage'));
const ParentsPage = lazy(() => import('@/pages/admin/ParentsPage'));
const AppealsPage = lazy(() => import('@/pages/admin/AppealsPage'));
const EventFeedbackPage = lazy(() => import('@/pages/admin/EventFeedbackPage'));
const StudentCategoriesPage = lazy(() => import('@/pages/admin/StudentCategoriesPage'));
const ShopManagePage = lazy(() => import('@/pages/admin/ShopManagePage'));
const ShopOrdersPage = lazy(() => import('@/pages/shared/ShopOrdersPage'));
const CoinOversightPage = lazy(() => import('@/pages/shared/CoinOversightPage'));
const SupportBookingPage = lazy(() => import('@/pages/student/SupportBookingPage'));
const MySupportHoursPage = lazy(() => import('@/pages/shared/MySupportHoursPage'));
const SupportOversightPage = lazy(() => import('@/pages/shared/SupportOversightPage'));
const MyProfilePage = lazy(() => import('@/pages/shared/MyProfilePage'));
const StudentShopPage = lazy(() => import('@/pages/student/ShopPage'));
const PermissionsPage = lazy(() => import('@/pages/admin/PermissionsPage'));

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
