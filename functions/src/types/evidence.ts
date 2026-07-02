export interface EvidenceDoc {
  id: string;
  uploaderId: string;
  type: 'before' | 'after';
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  uploadedAt: unknown;
}
