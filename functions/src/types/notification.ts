export type NotificationType =
  | 'request'
  | 'approved'
  | 'rejected'
  | 'reminder'
  | 'overdue'
  | 'payment'
  | 'dispute'
  | 'promo'
  | 'review'
  | 'chat';

export type NotificationClass = 'transactional' | 'marketing';

export interface NotificationDoc {
  id: string;
  userId: string;
  transactionId: string | null;
  type: NotificationType;
  class?: NotificationClass;
  title: string;
  body: string;
  deeplink?: string | null;
  imageUrl?: string | null;
  idempotencyKey?: string | null;
  isRead: boolean;
  isSent: boolean;
  scheduledAt: unknown;
  createdAt: unknown;
  sentAt?: unknown;
  pushMessageId?: string | null;
  providerStatus?: 'success' | 'failed' | 'skipped';
  failureReason?: string | null;
  attempt?: number;
  updatedAt?: unknown;
}
