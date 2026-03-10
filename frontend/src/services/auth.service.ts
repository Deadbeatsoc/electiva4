import api from './api';
import type { LoginRequest } from '../types/auth.types';

export const authService = {
  login: (data: LoginRequest) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', data),
  resetUserPassword: (userId: string, data: { newPassword: string }) =>
    api.post(`/auth/reset-password/${userId}`, data),
};
