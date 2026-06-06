export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';
export type DisputeCategory = 'handover_rejection' | 'ongoing_damage' | 'checkout_damage';

export interface DisputeDoc {
  id: string;
  transactionId: string;
  reportedBy: string;
  description: string;
  category: DisputeCategory;
  evidenceUrl: string | null;
  status: DisputeStatus;
  resolutionNote: string | null;
  resolvedBy: string | null;
  createdAt: unknown;
  resolvedAt: unknown | null;

  reporterName: string;
  renterName: string;
  itemNames: string[];
}
