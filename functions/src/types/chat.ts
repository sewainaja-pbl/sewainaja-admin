export interface ChatMessageDoc {
  id: string;
  senderId: string;
  message: string;
  messageType: 'text' | 'image';
  isRead: boolean;
  sentAt: unknown;
  deletedAt: unknown | null;
}
