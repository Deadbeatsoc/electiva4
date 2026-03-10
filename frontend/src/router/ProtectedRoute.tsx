import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { User } from '../types/auth.types';
import { getHomeRouteByRole, hasRequiredRole } from './roleUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, setAuth, logout, accessToken } = useAuthStore();
  const location = useLocation();

  const { isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await api.get('/auth/me');
      const userData: User = response.data.data;
      const token = accessToken || localStorage.getItem('accessToken');

      if (token) {
        setAuth(userData, token);
      } else {
        logout();
      }

      return userData;
    },
    enabled: isAuthenticated && !user,
    retry: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    throwOnError: false,
    refetchOnWindowFocus: false,
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isError && !user) {
    logout();
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-600 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRequiredRole(user.role?.name, allowedRoles)) {
    return <Navigate to={getHomeRouteByRole(user.role?.name)} replace />;
  }

  return <>{children}</>;
}
