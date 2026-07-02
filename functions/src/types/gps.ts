export interface GpsLogDoc {
  id: string;
  userId: string;
  coordinat: unknown; // admin.firestore.GeoPoint
  intervalMinutes: number;
  recordedAt: unknown;
}
