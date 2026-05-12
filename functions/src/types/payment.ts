export type PaymentMethod = 'midtrans' | 'cash' | 'manual_transfer';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export interface PaymentDoc {
  id: string;
  transactionId: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  midtransOrderId: string | null;
  midtransPaymentType: string | null;
  paymentProofUrl: string | null;
  paidAt: unknown | null;
  createdAt: unknown;
}
