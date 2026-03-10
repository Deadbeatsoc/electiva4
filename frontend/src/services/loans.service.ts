import api from './api';

interface LoansQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'RENEWED';
}

interface LoanPayload {
  amount: number;
}

export const loansService = {
  getAll: (params?: LoansQueryParams) => api.get('/loans', { params }),
  createForClient: (clientId: string, data: LoanPayload) =>
    api.post(`/loans/client/${clientId}`, data),
  renew: (loanId: string, data: LoanPayload) => api.post(`/loans/${loanId}/renew`, data),
};
