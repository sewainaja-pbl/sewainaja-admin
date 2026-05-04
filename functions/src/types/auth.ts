export type UserStatus = 'pending' | 'verified' | 'suspended';

export interface RequestUser {
  uid: string;
  email?: string;
  claims: Record<string, unknown>;
}

export interface UserDoc {
  id: string;
  name: string;
  email: string;
  phone: string;
  isOwner: boolean;
  isRenter: boolean;
  isAdmin: boolean;
  status: UserStatus;
  ktpPhotoUrl: string;
  selfiePhotoUrl: string;
  avgRatingAsRenter: number;
  avgRatingAsOwner: number;
  totalTransactions: number;
  fcmToken: string;
  createdAt: unknown;
  updatedAt: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
  }
}
