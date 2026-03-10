import api from './api';

export interface DashboardCollectorStatus {
  id: string;
  name: string;
  phone: string;
  isActiveUser: boolean;
  totalCollectedToday: number;
  totalExpensesToday: number;
  netToday: number;
  lastMovementAt: string | null;
  shiftStatus: 'OPEN' | 'CLOSED' | 'AUTO_CLOSED' | 'NOT_OPENED';
  hasClosedCash: boolean;
  shiftClosedAt: string | null;
  hoursWithoutActivity: number;
  isInactive: boolean;
  unreadInactivityAlerts: number;
}

export interface DashboardOverview {
  generatedAt: string;
  businessDate: string;
  kpis: {
    totalCollectedToday: number;
    activePortfolioTotal: number;
    activeClientsTotal: number;
    activeCollectors: number;
  };
  collectors: DashboardCollectorStatus[];
  unreadInactivityAlerts: {
    total: number;
    items: Array<{
      id: string;
      title: string;
      message: string;
      createdAt: string;
    }>;
  };
  inactivityThresholdHours: number;
  controlWindowStart: string;
}

export const dashboardService = {
  getOverview: () => api.get('/dashboard/overview'),
};
