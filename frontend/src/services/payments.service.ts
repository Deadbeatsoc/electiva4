import api from './api';

export interface CreatePaymentPayload {
  loanId: string;
  amount: number;
}

export const paymentsService = {
  create: (data: CreatePaymentPayload) => api.post('/payments', data),
};
