import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import MainLayout from '../components/layout/MainLayout';
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import ReportsPage from '../pages/dashboard/ReportsPage';
import ProfilePage from '../pages/profile/ProfilePage';
import UsersListPage from '../pages/admin/UsersListPage';
import ClientsPage from '../pages/collector/ClientsPage';
import ClientDetailPage from '../pages/collector/ClientDetailPage';
import LoansPage from '../pages/collector/LoansPage';
import PaymentsPage from '../pages/collector/PaymentsPage';
import CashRegisterPage from '../pages/collector/CashRegisterPage';
import { useAuthStore } from '../store/authStore';
import { getHomeRouteByRole } from './roleUtils';

function RoleHomeRedirect() {
  const user = useAuthStore((state) => state.user);
  return <Navigate to={getHomeRouteByRole(user?.role?.name)} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleHomeRedirect />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin', 'auxiliar']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="clients"
          element={
            <ProtectedRoute allowedRoles={['cobrador']}>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="clients/:id"
          element={
            <ProtectedRoute allowedRoles={['cobrador']}>
              <ClientDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="loans"
          element={
            <ProtectedRoute allowedRoles={['cobrador']}>
              <LoansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="payments"
          element={
            <ProtectedRoute allowedRoles={['cobrador']}>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="cash-register"
          element={
            <ProtectedRoute allowedRoles={['cobrador']}>
              <CashRegisterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'auxiliar']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersListPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<RoleHomeRedirect />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
