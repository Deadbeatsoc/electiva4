import api from './api';

export interface ReportCollector {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

export interface ReportFilters {
  from?: string;
  to?: string;
  collectorId?: string;
}

export interface CollectionSummaryReport {
  period: {
    from: string;
    to: string;
  };
  totals: {
    totalCollected: number;
    totalExpenses: number;
    net: number;
  };
  rows: Array<{
    collectorId: string;
    collectorName: string;
    collectorPhone: string;
    isActiveCollector: boolean;
    totalCollected: number;
    totalExpenses: number;
    net: number;
  }>;
}

export interface PortfolioStatusReport {
  generatedAt: string;
  totals: {
    activeLoans: number;
    totalPrincipal: number;
    totalPaid: number;
    totalRemaining: number;
  };
  rows: Array<{
    loanId: string;
    loanNumber: string;
    collectorId: string;
    collectorName: string;
    collectorPhone: string;
    clientId: string;
    clientName: string;
    clientCedula: string;
    clientPhone: string;
    principalAmount: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    disbursedAt: string;
    expectedEndDate: string;
    status: 'ACTIVE';
  }>;
}

export interface MovementHistoryReport {
  period: {
    from: string;
    to: string;
  };
  totals: {
    movementsCount: number;
    totalCollected: number;
    totalExpenses: number;
    net: number;
  };
  rows: Array<{
    id: string;
    movementId: string;
    type: 'PAYMENT' | 'EXPENSE';
    collectorId: string;
    collectorName: string;
    amount: number;
    timestamp: string;
    clientName: string | null;
    clientCedula: string | null;
    loanNumber: string | null;
    category: string | null;
    description: string | null;
  }>;
}

export interface CashClosuresReport {
  period: {
    from: string;
    to: string;
  };
  totals: {
    closuresCount: number;
    manualClosures: number;
    autoClosures: number;
    totalCollected: number;
    totalExpenses: number;
    totalNet: number;
  };
  rows: Array<{
    shiftId: string;
    collectorId: string;
    collectorName: string;
    collectorPhone: string;
    businessDate: string;
    status: 'CLOSED' | 'AUTO_CLOSED';
    isAutoClosed: boolean;
    openedAt: string;
    closedAt: string | null;
    totalCollected: number;
    totalExpenses: number;
    net: number;
  }>;
}

export const reportsService = {
  getCollectors: () => api.get('/reports/collectors'),
  getCollectionSummary: (params?: ReportFilters) =>
    api.get('/reports/collection-summary', { params }),
  getPortfolioStatus: (params?: Pick<ReportFilters, 'collectorId'>) =>
    api.get('/reports/portfolio-status', { params }),
  getMovementHistory: (params?: ReportFilters) =>
    api.get('/reports/movements', { params }),
  getCashClosures: (params?: ReportFilters) =>
    api.get('/reports/cash-closures', { params }),
};
