import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import AdminDashboard from '@/pages/admin/DashboardPage';
import TeacherDashboard from '@/pages/teacher/DashboardPage';
import TeacherPendingPage from '@/pages/teacher/PendingPage';
import StudentDashboard from '@/pages/student/DashboardPage';
import StudentNormativesPage from '@/pages/student/NormativesPage';
import StudentHistoryPage from '@/pages/student/HistoryPage';
import StudentRankingPage from '@/pages/student/RankingPage';
import MyNormativesGuidePage from '@/pages/student/MyNormativesGuidePage';
import GroupDetailPage from '@/pages/teacher/GroupDetailPage';
import TeacherNormativesPage from '@/pages/teacher/NormativesPage';
import StudentProfilePage from '@/pages/teacher/StudentProfilePage';
import ExportPage from '@/pages/shared/ExportPage';
import UsersPage from '@/pages/shared/UsersPage';
import GroupsPage from '@/pages/shared/GroupsPage';
import NormativesPage from '@/pages/shared/NormativesPage';
import AdminSubmissionsPage from '@/pages/admin/SubmissionsPage';
import AdminStatsPage from '@/pages/admin/StatsPage';
import AdminRankingsPage from '@/pages/admin/RankingsPage';
import AdminSettingsPage from '@/pages/admin/SettingsPage';
import MonthlyReportPrintPage from '@/pages/admin/MonthlyReportPrintPage';
import ViewerDashboardPage from '@/pages/viewer/DashboardPage';
import FrozenStudentsPage from '@/pages/shared/FrozenStudentsPage';
import MonitoringPage from '@/pages/shared/MonitoringPage';
import TeacherRatingPage from '@/pages/admin/TeacherRatingPage';
import ChecklistStatsPage from '@/pages/admin/ChecklistStatsPage';
import ChecklistManagePage from '@/pages/admin/ChecklistManagePage';
import PredictionsPage from '@/pages/admin/PredictionsPage';
import AIChatbot from '@/components/AIChatbot';
import { socket } from '@/utils/socket';
import { useEffect } from 'react';

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

import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

export default function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GlobalSocket />
        <BrowserRouter>
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
              <Route path="/teacher/users" element={<UsersPage />} />
              <Route path="/teacher/groups" element={<GroupsPage />} />
              <Route path="/teacher/groups/:id" element={<GroupDetailPage />} />
              <Route path="/teacher/student/:id" element={<StudentProfilePage />} />
              <Route path="/teacher/normatives" element={<TeacherNormativesPage />} />
              <Route path="/teacher/pending" element={<TeacherPendingPage />} />
              <Route path="/teacher/rankings" element={<StudentRankingPage />} />
              <Route path="/teacher/export" element={<ExportPage />} />
            </Route>

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
              <Route path="/viewer/:role/frozen-students" element={<FrozenStudentsPage />} />
              <Route path="/viewer/:role/monitoring" element={<MonitoringPage />} />
              <Route path="/viewer/:role/teacher-rating" element={<TeacherRatingPage />} />
              <Route path="/viewer/nazoratchi/checklist-stats" element={<ChecklistStatsPage />} />
              <Route path="/viewer/nazoratchi/checklist-manage" element={<ChecklistManagePage />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        <AIChatbot />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
