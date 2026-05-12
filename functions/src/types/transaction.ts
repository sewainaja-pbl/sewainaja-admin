export type TransactionStatus = 'pending' | 'approved' | 'ongoing' | 'completed' | 'cancelled' | 'disputed';

export interface TransactionDoc {
  id: string;
  renterId: string;
  ownerId: string;
  totalPrice: number;
  totalItems: number;
  status: TransactionStatus;
  isOverdue: boolean;
  
  qrCheckinTokenHash: string;
  qrCheckinExpiredAt: unknown;
  qrCheckinUsedAt: unknown | null;

  qrCheckoutTokenHash: string;
  qrCheckoutExpiredAt: unknown;
  qrCheckoutUsedAt: unknown | null;

  checkinAt: unknown | null;
  checkoutAt: unknown | null;
  createdAt: unknown;
  updatedAt: unknown;

  // Denormalized
  renterName: string;
  ownerName: string;
}

export interface TransactionDetailDoc {
  id: string;
  itemId: string;
  startDate: unknown;
  endDate: unknown;
  priceAtBooking: number;
  itemNameSnapshot: string;
  itemPhotoUrlSnapshot: string;
  subtotal: number;
}
