export interface ItemAddress {
  addressId: string;
  label: string;
  fullAddress: string;
  coordinat: unknown; // admin.firestore.GeoPoint
  geohash: string;
}

export type ItemStatus = 'available' | 'inactive' | 'archived';
export type ItemCondition = 'new' | 'like-new' | 'fair' | 'poor';

export interface ItemDoc {
  id: string;
  ownerId: string;
  categoryId: string;
  name: string;
  description: string;
  pricePerHour: number;
  estimatedValue: number;
  status: ItemStatus;
  condition: ItemCondition;
  photos: string[];
  qrCodeToken: string;
  createdAt: unknown; // admin.firestore.FieldValue | admin.firestore.Timestamp
  updatedAt: unknown;

  address: ItemAddress;

  ownerName: string;
  ownerRating: number;

  categoryName: string;
  categoryPhotoUrl: string;
}
