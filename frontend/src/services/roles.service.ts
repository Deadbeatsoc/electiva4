import api from './api';

export const rolesService = {
  getAll: () => api.get('/roles'),
  getById: (id: string) => api.get(`/roles/${id}`),
  create: (data: Record<string, unknown>) => api.post('/roles', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/roles/${id}`, data),
  assignPermissions: (roleId: string, permissionIds: string[]) =>
    api.put(`/roles/${roleId}/permissions`, { permissionIds }),
  getAllPermissions: () => api.get('/roles/permissions'),
};
