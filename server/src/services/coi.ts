import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  coiAssignments,
  coiAuditEvents,
  coiChecklistItems,
  coiComplianceReviews,
  coiDocumentMetadata,
  coiEndorsementEvidence,
  coiExceptions,
  coiPolicies,
  coiProjects,
  coiReminders,
  coiRequirementItems,
  coiRequirementSets,
  coiSubcontractors,
} from "@paperclipai/db";
import type {
  CoiAssignmentStatus,
  CoiChecklistStatus,
  CoiCoverageKind,
  CoiEndorsementInput,
  CoiExceptionStatus,
  CoiPolicyInput,
  CoiRequirementKind,
  CoiReviewerDecision,
  CoiRuleFinding,
  CreateCoiAssignmentInput,
  CreateCoiExceptionInput,
  CreateCoiProjectInput,
  CreateCoiSubcontractorInput,
  ReviewerDecisionInput,
  UpdateCoiAssignmentInput,
  UpdateCoiProjectInput,
  UpdateCoiSubcontractorInput,
  UpsertCoiDocumentInput,
} from "@paperclipai/shared";
import { notFound } from "../errors.js";

type RequirementRow = typeof coiRequirementItems.$inferSelect;
type AssignmentRow = typeof coiAssignments.$inferSelect;
type PolicyRow = typeof coiPolicies.$inferSelect;
type EndorsementRow = typeof coiEndorsementEvidence.$inferSelect;

const DEMO_REQUIREMENTS: Array<{
  requirementKey: string;
  title: string;
  kind: CoiRequirementKind;
  coverageKind?: CoiCoverageKind;
  minimumLimit?: number;
  endorsementKey?: string;
}> = [
  {
    requirementKey: "gl-1m",
    title: "General liability at least $1M",
    kind: "coverage",
    coverageKind: "general_liability",
    minimumLimit: 1_000_000,
  },
  {
    requirementKey: "auto-1m",
    title: "Auto liability at least $1M",
    kind: "coverage",
    coverageKind: "auto_liability",
    minimumLimit: 1_000_000,
  },
  {
    requirementKey: "wc-present",
    title: "Workers compensation policy present",
    kind: "coverage",
    coverageKind: "workers_comp",
  },
  {
    requirementKey: "additional-insured",
    title: "Additional insured endorsement evidence",
    kind: "endorsement",
    endorsementKey: "additional_insured",
  },
  {
    requirementKey: "waiver-subrogation",
    title: "Waiver of subrogation endorsement evidence",
    kind: "endorsement",
    endorsementKey: "waiver_of_subrogation",
  },
];

function asDateOnly(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function asDate(value: string | null | undefined) {
  return value && value.trim().length > 0 ? new Date(value) : new Date();
}

function normalizePolicy(input: CoiPolicyInput) {
  return {
    coverageKind: input.coverageKind,
    carrier: input.carrier ?? null,
    policyNumber: input.policyNumber ?? null,
    effectiveDate: asDateOnly(input.effectiveDate),
    expirationDate: asDateOnly(input.expirationDate),
    limitAmount: input.limitAmount ?? null,
  };
}

function endorsementPresent(value: EndorsementRow | CoiEndorsementInput | undefined) {
  if (!value) return false;
  if ("present" in value && typeof value.present === "boolean") return value.present;
  return String(value.present) === "true";
}

function findPolicy(policies: Array<PolicyRow | CoiPolicyInput>, coverageKind: CoiCoverageKind) {
  return policies.find((policy) => policy.coverageKind === coverageKind);
}

function policyExpiration(policy: PolicyRow | CoiPolicyInput) {
  return "expirationDate" in policy ? policy.expirationDate : policy.expirationDate;
}

function policyLimit(policy: PolicyRow | CoiPolicyInput) {
  return "limitAmount" in policy ? policy.limitAmount ?? null : null;
}

export function evaluateCoiRules(input: {
  requirements: RequirementRow[];
  policies: Array<PolicyRow | CoiPolicyInput>;
  endorsements: Array<EndorsementRow | CoiEndorsementInput>;
  now?: Date;
}): CoiRuleFinding[] {
  const now = input.now ?? new Date();
  const findings: CoiRuleFinding[] = [];

  for (const requirement of input.requirements) {
    if (requirement.kind === "coverage" && requirement.coverageKind) {
      const policy = findPolicy(input.policies, requirement.coverageKind);
      if (!policy) {
        findings.push({
          requirementKey: requirement.requirementKey,
          title: requirement.title,
          status: "fail",
          severity: "critical",
          detail: "Required coverage is missing.",
          evidence: { coverageKind: requirement.coverageKind },
        });
        continue;
      }

      const expiration = policyExpiration(policy);
      if (expiration && new Date(`${expiration}T23:59:59.999Z`).getTime() < now.getTime()) {
        findings.push({
          requirementKey: requirement.requirementKey,
          title: requirement.title,
          status: "fail",
          severity: "critical",
          detail: "Policy is expired.",
          evidence: { coverageKind: requirement.coverageKind, expirationDate: expiration },
        });
        continue;
      }

      const minimum = requirement.minimumLimit ?? null;
      const limit = policyLimit(policy);
      if (minimum !== null && (limit === null || limit < minimum)) {
        findings.push({
          requirementKey: requirement.requirementKey,
          title: requirement.title,
          status: "fail",
          severity: "critical",
          detail: "Policy limit is below the requirement.",
          evidence: { coverageKind: requirement.coverageKind, minimumLimit: minimum, limitAmount: limit },
        });
        continue;
      }

      findings.push({
        requirementKey: requirement.requirementKey,
        title: requirement.title,
        status: "pass",
        severity: "info",
        detail: "Coverage is present and meets the deterministic requirement.",
        evidence: { coverageKind: requirement.coverageKind, limitAmount: limit, expirationDate: expiration },
      });
      continue;
    }

    const endorsement = input.endorsements.find((item) => item.endorsementKey === requirement.endorsementKey);
    if (!endorsementPresent(endorsement)) {
      findings.push({
        requirementKey: requirement.requirementKey,
        title: requirement.title,
        status: "needs_review",
        severity: "warning",
        detail: "Endorsement evidence is missing and requires human review.",
        evidence: { endorsementKey: requirement.endorsementKey },
      });
      continue;
    }

    findings.push({
      requirementKey: requirement.requirementKey,
      title: requirement.title,
      status: "pass",
      severity: "info",
      detail: "Endorsement evidence is present.",
      evidence: { endorsementKey: requirement.endorsementKey },
    });
  }

  return findings;
}

function statusFromFindings(findings: CoiRuleFinding[]): CoiAssignmentStatus {
  if (findings.some((finding) => finding.status === "needs_review")) return "needs_review";
  if (findings.some((finding) => finding.status === "fail")) return "non_compliant";
  return "compliant";
}

function reminderReason(findings: CoiRuleFinding[]) {
  const failed = findings.filter((finding) => finding.status !== "pass");
  if (failed.length === 0) return null;
  return `Follow up on ${failed.length} COI checklist item${failed.length === 1 ? "" : "s"}.`;
}

export function coiService(db: Db) {
  async function audit(input: {
    companyId: string;
    assignmentId?: string | null;
    actorAgentId?: string | null;
    eventType: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    const [row] = await db.insert(coiAuditEvents).values({
      companyId: input.companyId,
      assignmentId: input.assignmentId ?? null,
      actorAgentId: input.actorAgentId ?? null,
      eventType: input.eventType,
      summary: input.summary,
      metadata: input.metadata ?? null,
    }).returning();
    return row;
  }

  async function assertAssignment(companyId: string, assignmentId: string) {
    const [assignment] = await db
      .select()
      .from(coiAssignments)
      .where(and(eq(coiAssignments.companyId, companyId), eq(coiAssignments.id, assignmentId)))
      .limit(1);
    if (!assignment) throw notFound("COI assignment not found");
    return assignment;
  }

  async function latestDocumentIds(companyId: string, assignmentId: string) {
    const docs = await db
      .select()
      .from(coiDocumentMetadata)
      .where(and(eq(coiDocumentMetadata.companyId, companyId), eq(coiDocumentMetadata.assignmentId, assignmentId)))
      .orderBy(desc(coiDocumentMetadata.receivedAt));
    return docs.map((doc) => doc.id);
  }

  async function loadAssignmentEvidence(companyId: string, assignment: AssignmentRow) {
    const requirements = await db
      .select()
      .from(coiRequirementItems)
      .where(eq(coiRequirementItems.requirementSetId, assignment.requirementSetId));
    const documentIds = await latestDocumentIds(companyId, assignment.id);
    if (documentIds.length === 0) {
      return { requirements, policies: [] as PolicyRow[], endorsements: [] as EndorsementRow[] };
    }
    const policies = await db.select().from(coiPolicies).where(inArray(coiPolicies.documentId, documentIds));
    const endorsements = await db
      .select()
      .from(coiEndorsementEvidence)
      .where(inArray(coiEndorsementEvidence.documentId, documentIds));
    return { requirements, policies, endorsements };
  }

  async function listBoard(companyId: string) {
    const assignments = await db
      .select()
      .from(coiAssignments)
      .where(eq(coiAssignments.companyId, companyId))
      .orderBy(desc(coiAssignments.updatedAt));
    return assignments;
  }

  async function createProject(companyId: string, input: CreateCoiProjectInput) {
    const [row] = await db.insert(coiProjects).values({
      companyId,
      name: input.name,
      description: input.description ?? null,
      startsOn: asDateOnly(input.startsOn),
      endsOn: asDateOnly(input.endsOn),
    }).returning();
    await audit({ companyId, eventType: "project.created", summary: `Created COI project ${row.name}.` });
    return row;
  }

  async function updateProject(companyId: string, id: string, input: UpdateCoiProjectInput) {
    const [row] = await db.update(coiProjects).set({
      ...input,
      startsOn: input.startsOn === undefined ? undefined : asDateOnly(input.startsOn),
      endsOn: input.endsOn === undefined ? undefined : asDateOnly(input.endsOn),
      updatedAt: new Date(),
    }).where(and(eq(coiProjects.companyId, companyId), eq(coiProjects.id, id))).returning();
    if (!row) throw notFound("COI project not found");
    await audit({ companyId, eventType: "project.updated", summary: `Updated COI project ${row.name}.` });
    return row;
  }

  async function createSubcontractor(companyId: string, input: CreateCoiSubcontractorInput) {
    const [row] = await db.insert(coiSubcontractors).values({
      companyId,
      legalName: input.legalName,
      trade: input.trade ?? null,
      contactEmail: input.contactEmail ?? null,
      contactName: input.contactName ?? null,
    }).returning();
    await audit({ companyId, eventType: "subcontractor.created", summary: `Created subcontractor ${row.legalName}.` });
    return row;
  }

  async function updateSubcontractor(companyId: string, id: string, input: UpdateCoiSubcontractorInput) {
    const [row] = await db.update(coiSubcontractors).set({
      ...input,
      updatedAt: new Date(),
    }).where(and(eq(coiSubcontractors.companyId, companyId), eq(coiSubcontractors.id, id))).returning();
    if (!row) throw notFound("COI subcontractor not found");
    await audit({ companyId, eventType: "subcontractor.updated", summary: `Updated subcontractor ${row.legalName}.` });
    return row;
  }

  async function createAssignment(companyId: string, input: CreateCoiAssignmentInput) {
    const [row] = await db.insert(coiAssignments).values({
      companyId,
      projectId: input.projectId,
      subcontractorId: input.subcontractorId,
      requirementSetId: input.requirementSetId,
      dueDate: asDateOnly(input.dueDate),
    }).returning();
    await audit({ companyId, assignmentId: row.id, eventType: "assignment.created", summary: "Created COI assignment." });
    return row;
  }

  async function updateAssignment(companyId: string, id: string, input: UpdateCoiAssignmentInput) {
    const [row] = await db.update(coiAssignments).set({
      ...input,
      dueDate: input.dueDate === undefined ? undefined : asDateOnly(input.dueDate),
      updatedAt: new Date(),
    }).where(and(eq(coiAssignments.companyId, companyId), eq(coiAssignments.id, id))).returning();
    if (!row) throw notFound("COI assignment not found");
    await audit({ companyId, assignmentId: row.id, eventType: "assignment.updated", summary: "Updated COI assignment." });
    return row;
  }

  async function getAssignmentDetail(companyId: string, assignmentId: string) {
    const assignment = await assertAssignment(companyId, assignmentId);
    const [project] = await db.select().from(coiProjects).where(eq(coiProjects.id, assignment.projectId)).limit(1);
    const [subcontractor] = await db.select().from(coiSubcontractors).where(eq(coiSubcontractors.id, assignment.subcontractorId)).limit(1);
    const [requirementSet] = await db.select().from(coiRequirementSets).where(eq(coiRequirementSets.id, assignment.requirementSetId)).limit(1);
    const requirements = await db.select().from(coiRequirementItems).where(eq(coiRequirementItems.requirementSetId, assignment.requirementSetId));
    const documents = await db.select().from(coiDocumentMetadata).where(eq(coiDocumentMetadata.assignmentId, assignmentId));
    const documentIds = documents.map((doc) => doc.id);
    const policies = documentIds.length ? await db.select().from(coiPolicies).where(inArray(coiPolicies.documentId, documentIds)) : [];
    const endorsements = documentIds.length
      ? await db.select().from(coiEndorsementEvidence).where(inArray(coiEndorsementEvidence.documentId, documentIds))
      : [];
    const checklist = await db.select().from(coiChecklistItems).where(eq(coiChecklistItems.assignmentId, assignmentId));
    const reviews = await db.select().from(coiComplianceReviews).where(eq(coiComplianceReviews.assignmentId, assignmentId)).orderBy(desc(coiComplianceReviews.createdAt));
    const exceptions = await db.select().from(coiExceptions).where(eq(coiExceptions.assignmentId, assignmentId)).orderBy(desc(coiExceptions.createdAt));
    const reminders = await db.select().from(coiReminders).where(eq(coiReminders.assignmentId, assignmentId)).orderBy(desc(coiReminders.createdAt));
    const auditEvents = await db.select().from(coiAuditEvents).where(eq(coiAuditEvents.assignmentId, assignmentId)).orderBy(desc(coiAuditEvents.createdAt));
    return { assignment, project, subcontractor, requirementSet, requirements, documents, policies, endorsements, checklist, reviews, exceptions, reminders, auditEvents };
  }

  async function upsertDocument(companyId: string, assignmentId: string, input: UpsertCoiDocumentInput) {
    await assertAssignment(companyId, assignmentId);
    const [document] = await db.insert(coiDocumentMetadata).values({
      companyId,
      assignmentId,
      documentName: input.documentName,
      documentType: input.documentType ?? "coi",
      receivedAt: asDate(input.receivedAt),
    }).returning();
    if (input.policies.length > 0) {
      await db.insert(coiPolicies).values(input.policies.map((policy) => ({
        companyId,
        documentId: document.id,
        ...normalizePolicy(policy),
      })));
    }
    if (input.endorsements.length > 0) {
      await db.insert(coiEndorsementEvidence).values(input.endorsements.map((endorsement) => ({
        companyId,
        documentId: document.id,
        endorsementKey: endorsement.endorsementKey,
        present: endorsement.present ? "true" : "false",
        sourceText: endorsement.sourceText ?? null,
      })));
    }
    await audit({
      companyId,
      assignmentId,
      eventType: "document.upserted",
      summary: `Recorded COI document ${document.documentName}.`,
      metadata: { policyCount: input.policies.length, endorsementCount: input.endorsements.length },
    });
    return getAssignmentDetail(companyId, assignmentId);
  }

  async function runChecks(companyId: string, assignmentId: string) {
    const assignment = await assertAssignment(companyId, assignmentId);
    const evidence = await loadAssignmentEvidence(companyId, assignment);
    const findings = evaluateCoiRules(evidence);
    await db.delete(coiChecklistItems).where(eq(coiChecklistItems.assignmentId, assignmentId));
    if (findings.length > 0) {
      await db.insert(coiChecklistItems).values(findings.map((finding) => ({
        companyId,
        assignmentId,
        requirementKey: finding.requirementKey,
        title: finding.title,
        status: finding.status,
        severity: finding.severity,
        detail: finding.detail,
        evidence: finding.evidence ?? null,
      })));
    }
    const status = statusFromFindings(findings);
    const reminder = reminderReason(findings);
    const reminderDueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const [updated] = await db.update(coiAssignments).set({
      status,
      nextReminderAt: reminder ? reminderDueAt : null,
      updatedAt: new Date(),
    }).where(eq(coiAssignments.id, assignmentId)).returning();
    if (reminder) {
      await db.insert(coiReminders).values({
        companyId,
        assignmentId,
        reason: reminder,
        dueAt: reminderDueAt,
      });
    }
    await audit({
      companyId,
      assignmentId,
      eventType: "checks.ran",
      summary: `Ran COI checks: ${status}.`,
      metadata: { findings },
    });
    return { assignment: updated, findings, reminderQueued: Boolean(reminder) };
  }

  async function recordReviewerDecision(companyId: string, assignmentId: string, input: ReviewerDecisionInput) {
    await assertAssignment(companyId, assignmentId);
    const statusByDecision: Record<CoiReviewerDecision, CoiAssignmentStatus> = {
      approved: "compliant",
      rejected: "non_compliant",
      needs_changes: "needs_review",
    };
    const [review] = await db.insert(coiComplianceReviews).values({
      companyId,
      assignmentId,
      decision: input.decision,
      reviewerNote: input.reviewerNote ?? null,
      reviewerAgentId: input.reviewerAgentId ?? null,
    }).returning();
    const [assignment] = await db.update(coiAssignments).set({
      status: statusByDecision[input.decision],
      lastReviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(coiAssignments.id, assignmentId)).returning();
    await audit({
      companyId,
      assignmentId,
      actorAgentId: input.reviewerAgentId ?? null,
      eventType: "review.decided",
      summary: `Reviewer decision: ${input.decision}.`,
      metadata: { reviewId: review.id },
    });
    return { assignment, review };
  }

  async function createException(companyId: string, assignmentId: string, input: CreateCoiExceptionInput) {
    await assertAssignment(companyId, assignmentId);
    const status: CoiExceptionStatus = new Date(input.expiresAt).getTime() <= Date.now() ? "expired" : "active";
    const [exception] = await db.insert(coiExceptions).values({
      companyId,
      assignmentId,
      status,
      reason: input.reason,
      expiresAt: new Date(input.expiresAt),
      approvedByAgentId: input.approvedByAgentId ?? null,
    }).returning();
    const [assignment] = await db.update(coiAssignments).set({
      status: status === "active" ? "excepted" : "non_compliant",
      updatedAt: new Date(),
    }).where(eq(coiAssignments.id, assignmentId)).returning();
    await audit({
      companyId,
      assignmentId,
      actorAgentId: input.approvedByAgentId ?? null,
      eventType: "exception.created",
      summary: `Created ${status} COI exception.`,
      metadata: { exceptionId: exception.id, expiresAt: exception.expiresAt.toISOString() },
    });
    return { assignment, exception };
  }

  async function seedDemo(companyId: string) {
    const existing = await db
      .select()
      .from(coiProjects)
      .where(and(eq(coiProjects.companyId, companyId), eq(coiProjects.name, "Demo Tower Renovation")))
      .limit(1);
    if (existing[0]) {
      return { project: existing[0], assignments: await listBoard(companyId), created: false };
    }

    const [requirementSet] = await db.insert(coiRequirementSets).values({
      companyId,
      name: "Standard GC COI Requirements",
      description: "Prototype requirement set for the no-integration COI workbench.",
    }).returning();
    await db.insert(coiRequirementItems).values(DEMO_REQUIREMENTS.map((item) => ({
      companyId,
      requirementSetId: requirementSet.id,
      ...item,
      minimumLimit: item.minimumLimit ?? null,
      coverageKind: item.coverageKind ?? null,
      endorsementKey: item.endorsementKey ?? null,
    })));
    const [project] = await db.insert(coiProjects).values({
      companyId,
      name: "Demo Tower Renovation",
      description: "Repeatable sample construction project for COI prototype demos.",
      startsOn: "2026-07-01",
      endsOn: "2026-12-31",
    }).returning();
    const [subcontractor] = await db.insert(coiSubcontractors).values({
      companyId,
      legalName: "Northstar Electrical LLC",
      trade: "Electrical",
      contactEmail: "ops@example.invalid",
      contactName: "Riley Chen",
    }).returning();
    const [assignment] = await db.insert(coiAssignments).values({
      companyId,
      projectId: project.id,
      subcontractorId: subcontractor.id,
      requirementSetId: requirementSet.id,
      dueDate: "2026-06-30",
    }).returning();
    await upsertDocument(companyId, assignment.id, {
      documentName: "Northstar sample COI",
      documentType: "manual",
      receivedAt: "2026-06-18T00:00:00.000Z",
      policies: [
        { coverageKind: "general_liability", carrier: "Acme Mutual", policyNumber: "GL-100", expirationDate: "2027-06-30", limitAmount: 1_000_000 },
        { coverageKind: "auto_liability", carrier: "Acme Mutual", policyNumber: "AL-200", expirationDate: "2027-06-30", limitAmount: 750_000 },
        { coverageKind: "workers_comp", carrier: "Acme Mutual", policyNumber: "WC-300", expirationDate: "2027-06-30" },
      ],
      endorsements: [{ endorsementKey: "additional_insured", present: true, sourceText: "Additional insured listed." }],
    });
    const checks = await runChecks(companyId, assignment.id);
    await audit({
      companyId,
      assignmentId: assignment.id,
      eventType: "demo.seeded",
      summary: "Seeded repeatable COI demo workflow.",
      metadata: { assignmentStatus: checks.assignment?.status },
    });
    return { project, subcontractor, requirementSet, assignment: checks.assignment, findings: checks.findings, created: true };
  }

  return {
    createAssignment,
    createException,
    createProject,
    createSubcontractor,
    getAssignmentDetail,
    listBoard,
    recordReviewerDecision,
    runChecks,
    seedDemo,
    updateAssignment,
    updateProject,
    updateSubcontractor,
    upsertDocument,
  };
}
