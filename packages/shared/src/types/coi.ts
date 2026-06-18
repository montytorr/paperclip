export type CoiAssignmentStatus = "pending" | "needs_review" | "compliant" | "non_compliant" | "excepted";
export type CoiChecklistStatus = "pass" | "fail" | "needs_review";
export type CoiRequirementKind = "coverage" | "endorsement";
export type CoiCoverageKind = "general_liability" | "auto_liability" | "workers_comp";
export type CoiReviewerDecision = "approved" | "rejected" | "needs_changes";
export type CoiExceptionStatus = "active" | "expired" | "revoked";
export type CoiReminderStatus = "queued" | "sent" | "cancelled";

export interface CoiPolicyInput {
  coverageKind: CoiCoverageKind;
  carrier?: string | null;
  policyNumber?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  limitAmount?: number | null;
}

export interface CoiEndorsementInput {
  endorsementKey: string;
  present: boolean;
  sourceText?: string | null;
}

export interface CoiDocumentInput {
  documentName: string;
  documentType?: string | null;
  receivedAt?: string | null;
  policies?: CoiPolicyInput[];
  endorsements?: CoiEndorsementInput[];
}

export interface CoiRuleFinding {
  requirementKey: string;
  status: CoiChecklistStatus;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  evidence?: Record<string, unknown>;
}

export interface CoiAssignmentSummary {
  id: string;
  projectId: string;
  subcontractorId: string;
  requirementSetId: string;
  status: CoiAssignmentStatus;
  dueDate: string | null;
  lastReviewedAt: Date | null;
  nextReminderAt: Date | null;
}
