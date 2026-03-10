import api from './api';

interface ClientsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

interface CreateClientPayload {
  name: string;
  cedula: string;
  phone: string;
  address: string;
  notes?: string;
}

export const clientsService = {
  getAll: (params?: ClientsQueryParams) => api.get('/clients', { params }),
  getById: (id: string) => api.get(`/clients/${id}`),
  create: (data: CreateClientPayload) => api.post('/clients', data),
};
