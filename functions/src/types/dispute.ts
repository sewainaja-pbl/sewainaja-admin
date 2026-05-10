export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';

export interface DisputeDoc {
  id: string;
  transactionId: string;
  reportedBy: string;
  description: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  resolvedBy: string | null;
  createdAt: unknown;
  resolvedAt: unknown | null;

  reporterName: string;
  renterName: string;
  itemNames: string[];
}
