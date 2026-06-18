CREATE TABLE "coi_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active' NOT NULL,
  "starts_on" date,
  "ends_on" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_subcontractors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "legal_name" text NOT NULL,
  "trade" text,
  "contact_email" text,
  "contact_name" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_requirement_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "version" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_requirement_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "requirement_set_id" uuid NOT NULL,
  "requirement_key" text NOT NULL,
  "title" text NOT NULL,
  "kind" text NOT NULL,
  "coverage_kind" text,
  "minimum_limit" integer,
  "endorsement_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "subcontractor_id" uuid NOT NULL,
  "requirement_set_id" uuid NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "due_date" date,
  "last_reviewed_at" timestamp with time zone,
  "next_reminder_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_document_metadata" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "document_name" text NOT NULL,
  "document_type" text DEFAULT 'coi' NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "coverage_kind" text NOT NULL,
  "carrier" text,
  "policy_number" text,
  "effective_date" date,
  "expiration_date" date,
  "limit_amount" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_endorsement_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "endorsement_key" text NOT NULL,
  "present" text DEFAULT 'false' NOT NULL,
  "source_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "requirement_key" text NOT NULL,
  "title" text NOT NULL,
  "status" text NOT NULL,
  "severity" text NOT NULL,
  "detail" text NOT NULL,
  "evidence" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_compliance_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "decision" text NOT NULL,
  "reviewer_note" text,
  "reviewer_agent_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "reason" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "approved_by_agent_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "reason" text NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "coi_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "assignment_id" uuid,
  "actor_agent_id" uuid,
  "event_type" text NOT NULL,
  "summary" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "coi_projects" ADD CONSTRAINT "coi_projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_subcontractors" ADD CONSTRAINT "coi_subcontractors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_requirement_sets" ADD CONSTRAINT "coi_requirement_sets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_requirement_items" ADD CONSTRAINT "coi_requirement_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_requirement_items" ADD CONSTRAINT "coi_requirement_items_requirement_set_id_coi_requirement_sets_id_fk" FOREIGN KEY ("requirement_set_id") REFERENCES "public"."coi_requirement_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_assignments" ADD CONSTRAINT "coi_assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_assignments" ADD CONSTRAINT "coi_assignments_project_id_coi_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."coi_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_assignments" ADD CONSTRAINT "coi_assignments_subcontractor_id_coi_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "public"."coi_subcontractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_assignments" ADD CONSTRAINT "coi_assignments_requirement_set_id_coi_requirement_sets_id_fk" FOREIGN KEY ("requirement_set_id") REFERENCES "public"."coi_requirement_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_document_metadata" ADD CONSTRAINT "coi_document_metadata_assignment_id_coi_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."coi_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_policies" ADD CONSTRAINT "coi_policies_document_id_coi_document_metadata_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."coi_document_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_endorsement_evidence" ADD CONSTRAINT "coi_endorsement_evidence_document_id_coi_document_metadata_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."coi_document_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_checklist_items" ADD CONSTRAINT "coi_checklist_items_assignment_id_coi_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."coi_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_compliance_reviews" ADD CONSTRAINT "coi_compliance_reviews_assignment_id_coi_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."coi_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_exceptions" ADD CONSTRAINT "coi_exceptions_assignment_id_coi_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."coi_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coi_reminders" ADD CONSTRAINT "coi_reminders_assignment_id_coi_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."coi_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coi_projects_company_idx" ON "coi_projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "coi_subcontractors_company_idx" ON "coi_subcontractors" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "coi_requirement_sets_company_idx" ON "coi_requirement_sets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "coi_requirement_items_set_idx" ON "coi_requirement_items" USING btree ("requirement_set_id");--> statement-breakpoint
CREATE INDEX "coi_assignments_company_status_idx" ON "coi_assignments" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "coi_assignments_project_idx" ON "coi_assignments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "coi_assignments_subcontractor_idx" ON "coi_assignments" USING btree ("subcontractor_id");--> statement-breakpoint
CREATE INDEX "coi_document_metadata_assignment_idx" ON "coi_document_metadata" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "coi_policies_document_idx" ON "coi_policies" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "coi_endorsement_evidence_document_idx" ON "coi_endorsement_evidence" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "coi_checklist_items_assignment_idx" ON "coi_checklist_items" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "coi_compliance_reviews_assignment_idx" ON "coi_compliance_reviews" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "coi_exceptions_assignment_idx" ON "coi_exceptions" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "coi_reminders_assignment_idx" ON "coi_reminders" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "coi_audit_events_assignment_idx" ON "coi_audit_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "coi_audit_events_company_idx" ON "coi_audit_events" USING btree ("company_id");
