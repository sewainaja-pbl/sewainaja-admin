export type UserStatus = 'unverified' | 'pending' | 'verified' | 'suspended' | 'rejected';

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
  bio?: string;
  isOwner: boolean;
  isRenter: boolean;
  isAdmin: boolean;
  status: UserStatus;
  rejectionReason?: string;
  profilePhotoUrl: string;
  ktpPhotoUrl: string;
  selfiePhotoUrl: string;
  avgRatingAsRenter: number;
  avgRatingAsOwner: number;
  totalTransactions: number;
  followersCount?: number;
  walletBalance?: number;
  fcmToken: string;
  createdAt: unknown;
  updatedAt: unknown;
  lastLoginAt?: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
  }
}
