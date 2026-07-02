export interface RatingDoc {
  id: string;
  transactionId: string;
  fromUserId: string;
  toUserId: string;
  ratedAs: 'owner' | 'renter';
  score: number; // 1-5
  comment: string;
  createdAt: unknown;

  // Denormalized
  fromUserName: string;
  toUserName: string;
  itemNames: string[];
}
