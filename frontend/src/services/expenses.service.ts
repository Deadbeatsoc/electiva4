import api from './api';

export interface CreateExpensePayload {
  category: string;
  amount: number;
  description?: string;
}

export const expensesService = {
  create: (data: CreateExpensePayload) => api.post('/expenses', data),
};
