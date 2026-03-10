import api from './api';

export type ShiftStatus = 'OPEN' | 'CLOSED' | 'AUTO_CLOSED' | 'NOT_OPENED';
export type MovementType = 'PAYMENT' | 'EXPENSE';

export interface CollectorMovement {
  id: string;
  type: MovementType;
  amount: number | string;
  timestamp: string;
  description: string | null;
  category: string | null;
  clientName: string | null;
  loanNumber: string | null;
}

export interface CollectorDayOverview {
  businessDate: string;
  timezone: string;
  summary: {
    totalCollected: number | string;
    totalExpenses: number | string;
    net: number | string;
    shiftStatus: ShiftStatus;
    closedAt: string | null;
  };
  previousClosure: {
    businessDate: string;
    status: 'CLOSED' | 'AUTO_CLOSED';
    totalCollected: number | string;
    totalExpenses: number | string;
    net: number | string;
    closedAt: string | null;
    isAutoClosed: boolean;
  } | null;
  movements: CollectorMovement[];
}

export interface CloseCashResult {
  shiftId: string;
  businessDate: string;
  status: 'CLOSED' | 'AUTO_CLOSED';
  totalCollected: number | string;
  totalExpenses: number | string;
  net: number | string;
  closedAt: string;
}

export const collectorService = {
  getDayOverview: () => api.get('/collector/day-overview'),
  closeCash: () => api.post('/collector/close-cash'),
};
