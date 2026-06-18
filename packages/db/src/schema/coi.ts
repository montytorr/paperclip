import { index, integer, jsonb, pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";
import type {
  CoiAssignmentStatus,
  CoiChecklistStatus,
  CoiCoverageKind,
  CoiExceptionStatus,
  CoiReminderStatus,
  CoiRequirementKind,
  CoiReviewerDecision,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const coiProjects = pgTable(
  "coi_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("coi_projects_company_idx").on(table.companyId),
  }),
);

export const coiSubcontractors = pgTable(
  "coi_subcontractors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    legalName: text("legal_name").notNull(),
    trade: text("trade"),
    contactEmail: text("contact_email"),
    contactName: text("contact_name"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("coi_subcontractors_company_idx").on(table.companyId),
  }),
);

export const coiRequirementSets = pgTable(
  "coi_requirement_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("coi_requirement_sets_company_idx").on(table.companyId),
  }),
);

export const coiRequirementItems = pgTable(
  "coi_requirement_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    requirementSetId: uuid("requirement_set_id").notNull().references(() => coiRequirementSets.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    title: text("title").notNull(),
    kind: text("kind").$type<CoiRequirementKind>().notNull(),
    coverageKind: text("coverage_kind").$type<CoiCoverageKind>(),
    minimumLimit: integer("minimum_limit"),
    endorsementKey: text("endorsement_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    setIdx: index("coi_requirement_items_set_idx").on(table.requirementSetId),
  }),
);

export const coiAssignments = pgTable(
  "coi_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull().references(() => coiProjects.id, { onDelete: "cascade" }),
    subcontractorId: uuid("subcontractor_id").notNull().references(() => coiSubcontractors.id, { onDelete: "cascade" }),
    requirementSetId: uuid("requirement_set_id").notNull().references(() => coiRequirementSets.id),
    status: text("status").$type<CoiAssignmentStatus>().notNull().default("pending"),
    dueDate: date("due_date"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReminderAt: timestamp("next_reminder_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("coi_assignments_company_status_idx").on(table.companyId, table.status),
    projectIdx: index("coi_assignments_project_idx").on(table.projectId),
    subcontractorIdx: index("coi_assignments_subcontractor_idx").on(table.subcontractorId),
  }),
);

export const coiDocumentMetadata = pgTable(
  "coi_document_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").notNull().references(() => coiAssignments.id, { onDelete: "cascade" }),
    documentName: text("document_name").notNull(),
    documentType: text("document_type").notNull().default("coi"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: index("coi_document_metadata_assignment_idx").on(table.assignmentId),
  }),
);

export const coiPolicies = pgTable(
  "coi_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => coiDocumentMetadata.id, { onDelete: "cascade" }),
    coverageKind: text("coverage_kind").$type<CoiCoverageKind>().notNull(),
    carrier: text("carrier"),
    policyNumber: text("policy_number"),
    effectiveDate: date("effective_date"),
    expirationDate: date("expiration_date"),
    limitAmount: integer("limit_amount"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentIdx: index("coi_policies_document_idx").on(table.documentId),
  }),
);

export const coiEndorsementEvidence = pgTable(
  "coi_endorsement_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => coiDocumentMetadata.id, { onDelete: "cascade" }),
    endorsementKey: text("endorsement_key").notNull(),
    present: text("present").notNull().default("false"),
    sourceText: text("source_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentIdx: index("coi_endorsement_evidence_document_idx").on(table.documentId),
  }),
);

export const coiChecklistItems = pgTable(
  "coi_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").notNull().references(() => coiAssignments.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    title: text("title").notNull(),
    status: text("status").$type<CoiChecklistStatus>().notNull(),
    severity: text("severity").notNull(),
    detail: text("detail").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: index("coi_checklist_items_assignment_idx").on(table.assignmentId),
  }),
);

export const coiComplianceReviews = pgTable(
  "coi_compliance_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").notNull().references(() => coiAssignments.id, { onDelete: "cascade" }),
    decision: text("decision").$type<CoiReviewerDecision>().notNull(),
    reviewerNote: text("reviewer_note"),
    reviewerAgentId: uuid("reviewer_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: index("coi_compliance_reviews_assignment_idx").on(table.assignmentId),
  }),
);

export const coiExceptions = pgTable(
  "coi_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").notNull().references(() => coiAssignments.id, { onDelete: "cascade" }),
    status: text("status").$type<CoiExceptionStatus>().notNull().default("active"),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    approvedByAgentId: uuid("approved_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: index("coi_exceptions_assignment_idx").on(table.assignmentId),
  }),
);

export const coiReminders = pgTable(
  "coi_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").notNull().references(() => coiAssignments.id, { onDelete: "cascade" }),
    status: text("status").$type<CoiReminderStatus>().notNull().default("queued"),
    reason: text("reason").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: index("coi_reminders_assignment_idx").on(table.assignmentId),
  }),
);

export const coiAuditEvents = pgTable(
  "coi_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => coiAssignments.id, { onDelete: "cascade" }),
    actorAgentId: uuid("actor_agent_id").references(() => agents.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: index("coi_audit_events_assignment_idx").on(table.assignmentId),
    companyIdx: index("coi_audit_events_company_idx").on(table.companyId),
  }),
);
