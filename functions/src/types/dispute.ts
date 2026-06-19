export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';
export type DisputeCategory = 'handover_rejection' | 'ongoing_damage' | 'checkout_damage' | 'other' | 'overdue_report';

export interface DisputeDoc {
  id: string;
  transactionId: string;
  reportedBy: string;
  description: string;
  category: DisputeCategory;
  evidenceUrl: string | null; // Keep for backward compatibility
  evidenceUrls?: string[]; // Multiple photos support for reporter
  status: DisputeStatus;
  resolutionNote: string | null;
  resolvedBy: string | null;
  createdAt: unknown;
  resolvedAt: unknown | null;
  deadlineAt?: unknown; // SLA 3x24h
  isOverdue?: boolean;

  // Respondent / Terlapor fields
  respondentId: string | null;
  respondentName: string | null;
  respondentDescription: string | null;
  respondentEvidenceUrls: string[]; // Rebuttal photos from respondent
  respondentRespondedAt: unknown | null;

  reporterName: string;
  renterName: string;
  itemNames: string[];
}
