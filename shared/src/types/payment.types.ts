export interface CreatePaymentDto {
  loanId: string;
  installmentId: string;
  amount: number;
}

export interface PaymentResponse {
  id: string;
  loanId: string;
  installmentId: string;
  collectorId: string;
  shiftId: string | null;
  amount: number;
  moraAmount: number;
  isLate: boolean;
  paymentTimestamp: string;
}
