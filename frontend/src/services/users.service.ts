import api from './api';

interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  roleId: string;
}

interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  roleId?: string;
  isActive?: boolean;
}

export const usersService = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: CreateUserPayload) => api.post('/users', data),
  update: (id: string, data: UpdateUserPayload) => api.put(`/users/${id}`, data),
  toggleActive: (id: string) => api.patch(`/users/${id}/toggle-active`),
};
