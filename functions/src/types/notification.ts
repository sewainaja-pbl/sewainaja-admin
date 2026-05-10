export type NotificationType = 'request' | 'approved' | 'reminder' | 'overdue' | 'payment' | 'dispute';

export interface NotificationDoc {
  id: string;
  userId: string;
  transactionId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  isSent: boolean;
  scheduledAt: unknown;
  createdAt: unknown;
}
