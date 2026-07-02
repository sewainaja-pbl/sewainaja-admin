export interface AddressDoc {
  id: string;
  label: string;
  fullAddress: string;
  coordinat: unknown; // admin.firestore.GeoPoint
  isDefault: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}
