import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { CoiReviewerDecision, UpsertCoiDocumentInput } from "@paperclipai/shared";
import { coiApi, type CoiAssignment, type CoiAssignmentDetail, type CoiChecklistItem } from "@/api/coi";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

const REVIEWER_DECISIONS: Array<{ value: CoiReviewerDecision; label: string }> = [
  { value: "needs_changes", label: "Request correction" },
  { value: "approved", label: "Approve" },
  { value: "rejected", label: "Reject" },
];

const STATUS_LABELS: Record<CoiAssignment["status"], string> = {
  pending: "Pending",
  needs_review: "Needs review",
  compliant: "Compliant",
  non_compliant: "Non-compliant",
  excepted: "Excepted",
};

const STATUS_STYLES: Record<CoiAssignment["status"], string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  needs_review: "border-amber-200 bg-amber-50 text-amber-800",
  compliant: "border-emerald-200 bg-emerald-50 text-emerald-800",
  non_compliant: "border-red-200 bg-red-50 text-red-800",
  excepted: "border-blue-200 bg-blue-50 text-blue-800",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "Not entered";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function statusBadge(status: CoiAssignment["status"]) {
  return (
    <Badge variant="outline" className={cn("rounded-sm", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function checklistTone(item: Pick<CoiChecklistItem, "status" | "severity">) {
  if (item.status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (item.severity === "critical") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function defaultDocumentInput(): UpsertCoiDocumentInput {
  return {
    documentName: "Manual demo COI",
    documentType: "manual",
    receivedAt: new Date().toISOString(),
    policies: [
      {
        coverageKind: "general_liability",
        carrier: "Acme Mutual",
        policyNumber: "GL-100",
        expirationDate: "2027-06-30",
        limitAmount: 1_000_000,
      },
      {
        coverageKind: "auto_liability",
        carrier: "Acme Mutual",
        policyNumber: "AL-200",
        expirationDate: "2026-06-28",
        limitAmount: 750_000,
      },
      {
        coverageKind: "workers_comp",
        carrier: "Acme Mutual",
        policyNumber: "WC-300",
        expirationDate: "2027-06-30",
        limitAmount: null,
      },
    ],
    endorsements: [
      { endorsementKey: "additional_insured", present: true, sourceText: "Additional insured listed." },
      { endorsementKey: "waiver_of_subrogation", present: false, sourceText: "Not shown on certificate." },
    ],
  };
}

export function CoiWorkbench() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [documentInput, setDocumentInput] = useState<UpsertCoiDocumentInput>(() => defaultDocumentInput());
  const [reviewerNote, setReviewerNote] = useState("Missing waiver endorsement; request corrected certificate.");
  const [exceptionReason, setExceptionReason] = useState("Site mobilization approved while corrected endorsement is collected.");

  useEffect(() => {
    setBreadcrumbs([{ label: "COI Workbench" }]);
  }, [setBreadcrumbs]);

  const boardQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.coi.board(selectedCompanyId) : ["coi", "board", "disabled"],
    queryFn: () => coiApi.board(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const assignments = boardQuery.data ?? [];
  const activeAssignmentId = selectedAssignmentId ?? assignments[0]?.id ?? null;

  useEffect(() => {
    if (!selectedAssignmentId && assignments[0]) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  const detailQuery = useQuery({
    queryKey: selectedCompanyId && activeAssignmentId
      ? queryKeys.coi.assignment(selectedCompanyId, activeAssignmentId)
      : ["coi", "assignment", "disabled"],
    queryFn: () => coiApi.assignment(selectedCompanyId!, activeAssignmentId!),
    enabled: !!selectedCompanyId && !!activeAssignmentId,
  });

  const refreshAssignment = async (assignmentId: string | null = activeAssignmentId) => {
    if (!selectedCompanyId) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.coi.board(selectedCompanyId) });
    if (assignmentId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.coi.assignment(selectedCompanyId, assignmentId) });
    }
  };

  const seedMutation = useMutation({
    mutationFn: () => coiApi.seedDemo(selectedCompanyId!),
    onSuccess: async (result) => {
      const nextId = result.assignment?.id ?? result.assignments?.[0]?.id ?? null;
      if (nextId) setSelectedAssignmentId(nextId);
      await refreshAssignment(nextId);
    },
  });

  const documentMutation = useMutation({
    mutationFn: () => coiApi.upsertDocument(selectedCompanyId!, activeAssignmentId!, documentInput),
    onSuccess: async () => refreshAssignment(),
  });

  const checksMutation = useMutation({
    mutationFn: () => coiApi.runChecks(selectedCompanyId!, activeAssignmentId!),
    onSuccess: async () => refreshAssignment(),
  });

  const reviewMutation = useMutation({
    mutationFn: (decision: CoiReviewerDecision) =>
      coiApi.reviewerDecision(selectedCompanyId!, activeAssignmentId!, {
        decision,
        reviewerNote,
      }),
    onSuccess: async () => refreshAssignment(),
  });

  const exceptionMutation = useMutation({
    mutationFn: () => {
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      return coiApi.createException(selectedCompanyId!, activeAssignmentId!, { reason: exceptionReason, expiresAt });
    },
    onSuccess: async () => refreshAssignment(),
  });

  const metrics = useMemo(() => {
    const open = assignments.filter((assignment) => assignment.status !== "compliant").length;
    const corrections = assignments.filter((assignment) => assignment.status === "needs_review" || assignment.status === "non_compliant").length;
    const reminders = assignments.filter((assignment) => assignment.nextReminderAt).length;
    return { open, corrections, reminders, total: assignments.length };
  }, [assignments]);

  if (!selectedCompanyId) {
    return <EmptyState icon={ShieldCheck} message="Select a company to open the COI workbench." />;
  }

  if (boardQuery.isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Construction COI copilot</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">Compliance workbench</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            No-integration prototype for queue triage, manual certificate evidence, rule checks, reviewer decisions, exceptions, reminders, and audit history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setDocumentInput(defaultDocumentInput())}
            title="Reset demo evidence"
          >
            <RotateCcw className="h-4 w-4" />
            Reset evidence
          </Button>
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            <ShieldCheck className="h-4 w-4" />
            {seedMutation.isPending ? "Seeding..." : "Seed demo"}
          </Button>
        </div>
      </header>

      {boardQuery.error ? (
        <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(boardQuery.error as Error).message}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Assignments" value={metrics.total} />
        <Metric label="Open items" value={metrics.open} />
        <Metric label="Corrections" value={metrics.corrections} />
        <Metric label="Reminders" value={metrics.reminders} />
      </section>

      {assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          message="No COI assignments yet. Seed the repeatable demo to start the prototype workflow."
          action={seedMutation.isPending ? "Seeding..." : "Seed demo"}
          onAction={() => seedMutation.mutate()}
        />
      ) : (
        <div className="grid min-h-[640px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <AssignmentQueue
            assignments={assignments}
            selectedAssignmentId={activeAssignmentId}
            onSelect={setSelectedAssignmentId}
          />
          <AssignmentDetailPanel
            detail={detailQuery.data}
            isLoading={detailQuery.isLoading}
            error={detailQuery.error as Error | null}
            documentInput={documentInput}
            setDocumentInput={setDocumentInput}
            reviewerNote={reviewerNote}
            setReviewerNote={setReviewerNote}
            exceptionReason={exceptionReason}
            setExceptionReason={setExceptionReason}
            onSaveDocument={() => documentMutation.mutate()}
            onRunChecks={() => checksMutation.mutate()}
            onReview={(decision) => reviewMutation.mutate(decision)}
            onException={() => exceptionMutation.mutate()}
            busy={
              documentMutation.isPending ||
              checksMutation.isPending ||
              reviewMutation.isPending ||
              exceptionMutation.isPending
            }
          />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function AssignmentQueue({
  assignments,
  selectedAssignmentId,
  onSelect,
}: {
  assignments: CoiAssignment[];
  selectedAssignmentId: string | null;
  onSelect: (assignmentId: string) => void;
}) {
  return (
    <aside className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Compliance queue</h2>
        <p className="mt-1 text-xs text-muted-foreground">Select an assignment to inspect evidence and review state.</p>
      </div>
      <div className="divide-y divide-border">
        {assignments.map((assignment) => (
          <button
            key={assignment.id}
            type="button"
            onClick={() => onSelect(assignment.id)}
            className={cn(
              "block w-full px-4 py-3 text-left transition-colors hover:bg-accent/40",
              selectedAssignmentId === assignment.id ? "bg-accent/60" : "bg-card",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">Assignment {assignment.id.slice(0, 8)}</span>
              {statusBadge(assignment.status)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Due {formatDate(assignment.dueDate)}</span>
              <span>{assignment.nextReminderAt ? "Reminder queued" : "No reminder"}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function AssignmentDetailPanel({
  detail,
  isLoading,
  error,
  documentInput,
  setDocumentInput,
  reviewerNote,
  setReviewerNote,
  exceptionReason,
  setExceptionReason,
  onSaveDocument,
  onRunChecks,
  onReview,
  onException,
  busy,
}: {
  detail: CoiAssignmentDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  documentInput: UpsertCoiDocumentInput;
  setDocumentInput: (input: UpsertCoiDocumentInput) => void;
  reviewerNote: string;
  setReviewerNote: (value: string) => void;
  exceptionReason: string;
  setExceptionReason: (value: string) => void;
  onSaveDocument: () => void;
  onRunChecks: () => void;
  onReview: (decision: CoiReviewerDecision) => void;
  onException: () => void;
  busy: boolean;
}) {
  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) {
    return <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error.message}</div>;
  }
  if (!detail) {
    return <EmptyState icon={FileText} message="Select a COI assignment to view details." />;
  }

  return (
    <main className="space-y-4">
      <section className="border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{detail.subcontractor?.legalName ?? "Unknown subcontractor"}</h2>
              {statusBadge(detail.assignment.status)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {detail.project?.name ?? "Unknown project"} · {detail.subcontractor?.trade ?? "Trade not set"} · due {formatDate(detail.assignment.dueDate)}
            </div>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:min-w-72">
            <Info label="Requirement set" value={detail.requirementSet?.name ?? "Not set"} />
            <Info label="Last reviewed" value={formatDate(detail.assignment.lastReviewedAt)} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <ManualEvidenceForm
            input={documentInput}
            onChange={setDocumentInput}
            onSave={onSaveDocument}
            onRunChecks={onRunChecks}
            busy={busy}
          />
          <Checklist detail={detail} />
          <Evidence detail={detail} />
        </section>
        <aside className="space-y-4">
          <ReviewerPanel
            reviewerNote={reviewerNote}
            setReviewerNote={setReviewerNote}
            exceptionReason={exceptionReason}
            setExceptionReason={setExceptionReason}
            onReview={onReview}
            onException={onException}
            busy={busy}
          />
          <RemindersAndAudit detail={detail} />
        </aside>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-medium uppercase">{label}</div>
      <div className="mt-0.5 text-foreground">{value}</div>
    </div>
  );
}

function ManualEvidenceForm({
  input,
  onChange,
  onSave,
  onRunChecks,
  busy,
}: {
  input: UpsertCoiDocumentInput;
  onChange: (input: UpsertCoiDocumentInput) => void;
  onSave: () => void;
  onRunChecks: () => void;
  busy: boolean;
}) {
  const policies = input.policies ?? [];
  const endorsements = input.endorsements ?? [];

  const updatePolicy = (index: number, patch: Partial<NonNullable<UpsertCoiDocumentInput["policies"]>[number]>) => {
    onChange({ ...input, policies: policies.map((policy, policyIndex) => policyIndex === index ? { ...policy, ...patch } : policy) });
  };

  const updateEndorsement = (index: number, present: boolean) => {
    onChange({
      ...input,
      endorsements: endorsements.map((endorsement, endorsementIndex) =>
        endorsementIndex === index ? { ...endorsement, present } : endorsement,
      ),
    });
  };

  return (
    <section className="border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Manual COI entry</h3>
          <p className="mt-1 text-xs text-muted-foreground">Enter certificate facts directly; no OCR or external document service is required.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onSave} disabled={busy}>
            <FileText className="h-4 w-4" />
            Save evidence
          </Button>
          <Button onClick={onRunChecks} disabled={busy}>
            <ClipboardCheck className="h-4 w-4" />
            Run checks
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="coi-document-name">Document name</Label>
          <Input
            id="coi-document-name"
            value={input.documentName}
            onChange={(event) => onChange({ ...input, documentName: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="coi-received-at">Received at</Label>
          <Input
            id="coi-received-at"
            value={input.receivedAt ?? ""}
            onChange={(event) => onChange({ ...input, receivedAt: event.target.value })}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 text-left font-medium">Coverage</th>
              <th className="px-3 py-2 text-left font-medium">Carrier</th>
              <th className="px-3 py-2 text-left font-medium">Policy</th>
              <th className="px-3 py-2 text-left font-medium">Expiration</th>
              <th className="pl-3 py-2 text-left font-medium">Limit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {policies.map((policy, index) => (
              <tr key={policy.coverageKind}>
                <td className="py-2 pr-3 font-medium">{policy.coverageKind.replace("_", " ")}</td>
                <td className="px-3 py-2">
                  <Input value={policy.carrier ?? ""} onChange={(event) => updatePolicy(index, { carrier: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input value={policy.policyNumber ?? ""} onChange={(event) => updatePolicy(index, { policyNumber: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input value={policy.expirationDate ?? ""} onChange={(event) => updatePolicy(index, { expirationDate: event.target.value })} />
                </td>
                <td className="pl-3 py-2">
                  <Input
                    type="number"
                    value={policy.limitAmount ?? ""}
                    onChange={(event) => updatePolicy(index, { limitAmount: event.target.value ? Number(event.target.value) : null })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {endorsements.map((endorsement, index) => (
          <label key={endorsement.endorsementKey} className="flex items-start gap-3 border border-border p-3 text-sm">
            <Checkbox checked={endorsement.present} onCheckedChange={(checked) => updateEndorsement(index, checked === true)} />
            <span>
              <span className="block font-medium">{endorsement.endorsementKey.replaceAll("_", " ")}</span>
              <span className="text-xs text-muted-foreground">{endorsement.sourceText ?? "No source text"}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function Checklist({ detail }: { detail: CoiAssignmentDetail }) {
  return (
    <section className="border border-border bg-card p-4">
      <h3 className="text-base font-semibold">Requirement checklist</h3>
      <div className="mt-3 grid gap-2">
        {(detail.checklist.length > 0 ? detail.checklist : detail.requirements).map((item) => {
          const status = "status" in item ? item.status : "needs_review";
          const severity = "severity" in item ? item.severity : "info";
          const detailText = "detail" in item ? item.detail : "Run checks to evaluate this requirement.";
          return (
            <div key={item.id} className="flex items-start justify-between gap-3 border border-border p-3">
              <div>
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{detailText}</div>
              </div>
              <Badge variant="outline" className={cn("rounded-sm", checklistTone({ status, severity }))}>
                {status.replace("_", " ")}
              </Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Evidence({ detail }: { detail: CoiAssignmentDetail }) {
  return (
    <section className="border border-border bg-card p-4">
      <h3 className="text-base font-semibold">Recorded evidence</h3>
      {detail.documents.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No manual evidence has been saved yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {detail.documents.map((document) => (
            <div key={document.id} className="border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{document.documentName}</div>
                <div className="text-xs text-muted-foreground">{formatDate(document.receivedAt)}</div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {detail.policies.filter((policy) => policy.documentId === document.id).map((policy) => (
                  <div key={policy.id} className="bg-muted/40 p-2 text-xs">
                    <div className="font-medium">{policy.coverageKind.replace("_", " ")}</div>
                    <div>{policy.carrier ?? "No carrier"} · {policy.policyNumber ?? "No policy"}</div>
                    <div>Expires {formatDate(policy.expirationDate)} · {formatMoney(policy.limitAmount)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewerPanel({
  reviewerNote,
  setReviewerNote,
  exceptionReason,
  setExceptionReason,
  onReview,
  onException,
  busy,
}: {
  reviewerNote: string;
  setReviewerNote: (value: string) => void;
  exceptionReason: string;
  setExceptionReason: (value: string) => void;
  onReview: (decision: CoiReviewerDecision) => void;
  onException: () => void;
  busy: boolean;
}) {
  return (
    <section className="border border-border bg-card p-4">
      <h3 className="text-base font-semibold">Reviewer decision</h3>
      <div className="mt-3 space-y-2">
        <Label htmlFor="coi-review-note">Reviewer note</Label>
        <Textarea
          id="coi-review-note"
          value={reviewerNote}
          onChange={(event) => setReviewerNote(event.target.value)}
          rows={4}
        />
      </div>
      <div className="mt-3 grid gap-2">
        {REVIEWER_DECISIONS.map((decision) => (
          <Button
            key={decision.value}
            variant={decision.value === "needs_changes" ? "default" : "outline"}
            onClick={() => onReview(decision.value)}
            disabled={busy}
          >
            {decision.value === "approved" ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {decision.label}
          </Button>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="text-sm font-semibold">Exception</h4>
        <div className="mt-2 space-y-2">
          <Label htmlFor="coi-exception-reason">Reason</Label>
          <Textarea
            id="coi-exception-reason"
            value={exceptionReason}
            onChange={(event) => setExceptionReason(event.target.value)}
            rows={3}
          />
        </div>
        <Button className="mt-3 w-full" variant="outline" onClick={onException} disabled={busy}>
          <CalendarClock className="h-4 w-4" />
          Approve 14-day exception
        </Button>
      </div>
    </section>
  );
}

function RemindersAndAudit({ detail }: { detail: CoiAssignmentDetail }) {
  return (
    <section className="border border-border bg-card p-4">
      <h3 className="text-base font-semibold">Reminders and audit</h3>
      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            Reminders
          </div>
          {detail.reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders queued.</p>
          ) : (
            <div className="space-y-2">
              {detail.reminders.map((reminder) => (
                <div key={reminder.id} className="border border-border p-2 text-sm">
                  <div className="font-medium">{reminder.reason}</div>
                  <div className="text-xs text-muted-foreground">{reminder.status} · due {formatDate(reminder.dueAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Audit trail</div>
          {detail.auditEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            <ol className="space-y-2">
              {detail.auditEvents.slice(0, 8).map((event) => (
                <li key={event.id} className="text-sm">
                  <div className="font-medium">{event.summary}</div>
                  <div className="text-xs text-muted-foreground">{event.eventType} · {formatDate(event.createdAt)}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
