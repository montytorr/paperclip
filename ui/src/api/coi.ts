import type {
  CoiAssignmentStatus,
  CoiChecklistStatus,
  CoiCoverageKind,
  CoiReviewerDecision,
  CoiRuleFinding,
  UpsertCoiDocumentInput,
} from "@paperclipai/shared";
import { api } from "./client";

export interface CoiAssignment {
  id: string;
  companyId: string;
  projectId: string;
  subcontractorId: string;
  requirementSetId: string;
  status: CoiAssignmentStatus;
  dueDate: string | null;
  lastReviewedAt: string | null;
  nextReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoiProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
}

export interface CoiSubcontractor {
  id: string;
  legalName: string;
  trade: string | null;
  contactEmail: string | null;
  contactName: string | null;
  status: string;
}

export interface CoiRequirementSet {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
}

export interface CoiRequirementItem {
  id: string;
  requirementKey: string;
  title: string;
  kind: "coverage" | "endorsement";
  coverageKind: CoiCoverageKind | null;
  minimumLimit: number | null;
  endorsementKey: string | null;
}

export interface CoiDocumentMetadata {
  id: string;
  documentName: string;
  documentType: string;
  receivedAt: string;
}

export interface CoiPolicy {
  id: string;
  documentId: string;
  coverageKind: CoiCoverageKind;
  carrier: string | null;
  policyNumber: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  limitAmount: number | null;
}

export interface CoiEndorsementEvidence {
  id: string;
  documentId: string;
  endorsementKey: string;
  present: "true" | "false" | boolean;
  sourceText: string | null;
}

export interface CoiChecklistItem {
  id: string;
  requirementKey: string;
  title: string;
  status: CoiChecklistStatus;
  severity: "info" | "warning" | "critical";
  detail: string;
  evidence: Record<string, unknown> | null;
}

export interface CoiComplianceReview {
  id: string;
  decision: CoiReviewerDecision;
  reviewerNote: string | null;
  createdAt: string;
}

export interface CoiException {
  id: string;
  status: "active" | "expired" | "revoked";
  reason: string;
  expiresAt: string;
  createdAt: string;
}

export interface CoiReminder {
  id: string;
  status: "queued" | "sent" | "cancelled";
  reason: string;
  dueAt: string;
  sentAt: string | null;
  createdAt: string;
}

export interface CoiAuditEvent {
  id: string;
  eventType: string;
  summary: string;
  createdAt: string;
}

export interface CoiAssignmentDetail {
  assignment: CoiAssignment;
  project: CoiProject | null;
  subcontractor: CoiSubcontractor | null;
  requirementSet: CoiRequirementSet | null;
  requirements: CoiRequirementItem[];
  documents: CoiDocumentMetadata[];
  policies: CoiPolicy[];
  endorsements: CoiEndorsementEvidence[];
  checklist: CoiChecklistItem[];
  reviews: CoiComplianceReview[];
  exceptions: CoiException[];
  reminders: CoiReminder[];
  auditEvents: CoiAuditEvent[];
}

export interface CoiSeedResult {
  project: CoiProject;
  subcontractor?: CoiSubcontractor;
  requirementSet?: CoiRequirementSet;
  assignment?: CoiAssignment;
  assignments?: CoiAssignment[];
  findings?: CoiRuleFinding[];
  created: boolean;
}

export interface CoiRunChecksResult {
  assignment: CoiAssignment;
  findings: CoiRuleFinding[];
  reminderQueued: boolean;
}

export interface CoiReviewerDecisionResult {
  assignment: CoiAssignment;
  review: CoiComplianceReview;
}

export interface CoiExceptionResult {
  assignment: CoiAssignment;
  exception: CoiException;
}

export const coiApi = {
  seedDemo: (companyId: string) =>
    api.post<CoiSeedResult>(`/coi/companies/${companyId}/demo-seed`, {}),
  board: (companyId: string) =>
    api.get<CoiAssignment[]>(`/coi/companies/${companyId}/board`),
  assignment: (companyId: string, assignmentId: string) =>
    api.get<CoiAssignmentDetail>(`/coi/companies/${companyId}/assignments/${assignmentId}`),
  upsertDocument: (companyId: string, assignmentId: string, input: UpsertCoiDocumentInput) =>
    api.post<CoiAssignmentDetail>(`/coi/companies/${companyId}/assignments/${assignmentId}/document`, input),
  runChecks: (companyId: string, assignmentId: string) =>
    api.post<CoiRunChecksResult>(`/coi/companies/${companyId}/assignments/${assignmentId}/run-checks`, {}),
  reviewerDecision: (
    companyId: string,
    assignmentId: string,
    input: { decision: CoiReviewerDecision; reviewerNote?: string | null },
  ) =>
    api.post<CoiReviewerDecisionResult>(
      `/coi/companies/${companyId}/assignments/${assignmentId}/reviewer-decision`,
      input,
    ),
  createException: (
    companyId: string,
    assignmentId: string,
    input: { reason: string; expiresAt: string },
  ) =>
    api.post<CoiExceptionResult>(`/coi/companies/${companyId}/assignments/${assignmentId}/exceptions`, input),
};
