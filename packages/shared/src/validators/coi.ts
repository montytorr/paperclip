import { z } from "zod";

export const coiCoverageKindSchema = z.enum(["general_liability", "auto_liability", "workers_comp"]);
export const coiReviewerDecisionSchema = z.enum(["approved", "rejected", "needs_changes"]);

export const createCoiProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  startsOn: z.string().trim().optional().nullable(),
  endsOn: z.string().trim().optional().nullable(),
});

export const updateCoiProjectSchema = createCoiProjectSchema.partial().extend({
  status: z.enum(["active", "archived"]).optional(),
});

export const createCoiSubcontractorSchema = z.object({
  legalName: z.string().trim().min(1),
  trade: z.string().trim().optional().nullable(),
  contactEmail: z.string().trim().email().optional().nullable(),
  contactName: z.string().trim().optional().nullable(),
});

export const updateCoiSubcontractorSchema = createCoiSubcontractorSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
});

export const createCoiAssignmentSchema = z.object({
  projectId: z.string().uuid(),
  subcontractorId: z.string().uuid(),
  requirementSetId: z.string().uuid(),
  dueDate: z.string().trim().optional().nullable(),
});

export const updateCoiAssignmentSchema = z.object({
  dueDate: z.string().trim().optional().nullable(),
  status: z.enum(["pending", "needs_review", "compliant", "non_compliant", "excepted"]).optional(),
});

export const coiPolicyInputSchema = z.object({
  coverageKind: coiCoverageKindSchema,
  carrier: z.string().trim().optional().nullable(),
  policyNumber: z.string().trim().optional().nullable(),
  effectiveDate: z.string().trim().optional().nullable(),
  expirationDate: z.string().trim().optional().nullable(),
  limitAmount: z.number().int().nonnegative().optional().nullable(),
});

export const coiEndorsementInputSchema = z.object({
  endorsementKey: z.string().trim().min(1),
  present: z.boolean(),
  sourceText: z.string().trim().optional().nullable(),
});

export const upsertCoiDocumentSchema = z.object({
  documentName: z.string().trim().min(1),
  documentType: z.string().trim().optional().nullable(),
  receivedAt: z.string().trim().optional().nullable(),
  policies: z.array(coiPolicyInputSchema).optional().default([]),
  endorsements: z.array(coiEndorsementInputSchema).optional().default([]),
});

export const reviewerDecisionSchema = z.object({
  decision: coiReviewerDecisionSchema,
  reviewerNote: z.string().trim().optional().nullable(),
  reviewerAgentId: z.string().uuid().optional().nullable(),
});

export const createCoiExceptionSchema = z.object({
  reason: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1),
  approvedByAgentId: z.string().uuid().optional().nullable(),
});

export type CreateCoiProjectInput = z.infer<typeof createCoiProjectSchema>;
export type UpdateCoiProjectInput = z.infer<typeof updateCoiProjectSchema>;
export type CreateCoiSubcontractorInput = z.infer<typeof createCoiSubcontractorSchema>;
export type UpdateCoiSubcontractorInput = z.infer<typeof updateCoiSubcontractorSchema>;
export type CreateCoiAssignmentInput = z.infer<typeof createCoiAssignmentSchema>;
export type UpdateCoiAssignmentInput = z.infer<typeof updateCoiAssignmentSchema>;
export type UpsertCoiDocumentInput = z.infer<typeof upsertCoiDocumentSchema>;
export type ReviewerDecisionInput = z.infer<typeof reviewerDecisionSchema>;
export type CreateCoiExceptionInput = z.infer<typeof createCoiExceptionSchema>;
