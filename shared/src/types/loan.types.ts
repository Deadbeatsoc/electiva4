import { LoanStatus } from './enums';

export interface CreateLoanDto {
  clientId: string;
  principalAmount: number;
  interestRate: number;
  totalInstallments?: number;
}

export interface LoanResponse {
  id: string;
  loanNumber: string;
  clientId: string;
  collectorId: string;
  principalAmount: number;
  interestRate: number;
  totalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  paidAmount: number;
  remainingAmount: number;
  overdueDays: number;
  moraAmount: number;
  status: LoanStatus;
  disbursedAt: string;
  expectedEndDate: string;
  createdAt: string;
}
