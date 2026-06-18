// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoiWorkbench } from "./CoiWorkbench";
import type { CoiAssignment, CoiAssignmentDetail } from "@/api/coi";

const coiApiMock = vi.hoisted(() => ({
  board: vi.fn(),
  assignment: vi.fn(),
  seedDemo: vi.fn(),
  upsertDocument: vi.fn(),
  runChecks: vi.fn(),
  reviewerDecision: vi.fn(),
  createException: vi.fn(),
}));

vi.mock("@/api/coi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/coi")>();
  return {
    ...actual,
    coiApi: coiApiMock,
  };
});

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    selectedCompany: { id: "company-1", name: "Paperclip", issuePrefix: "OPE" },
  }),
}));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const assignment: CoiAssignment = {
  id: "assignment-1",
  companyId: "company-1",
  projectId: "project-1",
  subcontractorId: "sub-1",
  requirementSetId: "req-1",
  status: "needs_review",
  dueDate: "2026-06-30",
  lastReviewedAt: null,
  nextReminderAt: "2026-06-20T00:00:00.000Z",
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-18T00:00:00.000Z",
};

const detail: CoiAssignmentDetail = {
  assignment,
  project: {
    id: "project-1",
    name: "Demo Tower Renovation",
    description: "Demo project",
    status: "active",
    startsOn: "2026-07-01",
    endsOn: "2026-12-31",
  },
  subcontractor: {
    id: "sub-1",
    legalName: "Northstar Electrical LLC",
    trade: "Electrical",
    contactEmail: "ops@example.invalid",
    contactName: "Riley Chen",
    status: "active",
  },
  requirementSet: {
    id: "req-1",
    name: "Standard GC COI Requirements",
    description: "Prototype requirements",
    version: 1,
    status: "active",
  },
  requirements: [
    {
      id: "requirement-1",
      requirementKey: "auto_liability",
      title: "Auto liability",
      kind: "coverage",
      coverageKind: "auto_liability",
      minimumLimit: 1_000_000,
      endorsementKey: null,
    },
  ],
  documents: [
    {
      id: "document-1",
      documentName: "Northstar sample COI",
      documentType: "manual",
      receivedAt: "2026-06-18T00:00:00.000Z",
    },
  ],
  policies: [
    {
      id: "policy-1",
      documentId: "document-1",
      coverageKind: "auto_liability",
      carrier: "Acme Mutual",
      policyNumber: "AL-200",
      effectiveDate: null,
      expirationDate: "2026-06-28",
      limitAmount: 750_000,
    },
  ],
  endorsements: [],
  checklist: [
    {
      id: "check-1",
      requirementKey: "waiver_of_subrogation",
      title: "Waiver of subrogation",
      status: "fail",
      severity: "critical",
      detail: "Waiver endorsement is missing.",
      evidence: null,
    },
  ],
  reviews: [],
  exceptions: [],
  reminders: [
    {
      id: "reminder-1",
      status: "queued",
      reason: "Follow up on 1 COI checklist item.",
      dueAt: "2026-06-20T00:00:00.000Z",
      sentAt: null,
      createdAt: "2026-06-18T00:00:00.000Z",
    },
  ],
  auditEvents: [
    {
      id: "audit-1",
      eventType: "checks.ran",
      summary: "Ran COI checks: needs_review.",
      createdAt: "2026-06-18T00:00:00.000Z",
    },
  ],
};

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function waitForText(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await flushReact();
  }
  expect(container.textContent).toContain(text);
}

function renderWorkbench(container: HTMLElement) {
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <CoiWorkbench />
      </QueryClientProvider>,
    );
  });

  return root;
}

function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  expect(button).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("CoiWorkbench", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    coiApiMock.board.mockResolvedValue([assignment]);
    coiApiMock.assignment.mockResolvedValue(detail);
    coiApiMock.seedDemo.mockResolvedValue({ project: detail.project, assignment, created: true });
    coiApiMock.upsertDocument.mockResolvedValue(detail);
    coiApiMock.runChecks.mockResolvedValue({ assignment, findings: [], reminderQueued: true });
    coiApiMock.reviewerDecision.mockResolvedValue({
      assignment: { ...assignment, status: "non_compliant" },
      review: { id: "review-1", decision: "needs_changes", reviewerNote: "Fix it", createdAt: "2026-06-18" },
    });
    coiApiMock.createException.mockResolvedValue({
      assignment: { ...assignment, status: "excepted" },
      exception: {
        id: "exception-1",
        status: "active",
        reason: "Approved temporarily",
        expiresAt: "2026-07-01T00:00:00.000Z",
        createdAt: "2026-06-18T00:00:00.000Z",
      },
    });
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("shows an empty state and can seed the repeatable demo", async () => {
    coiApiMock.board.mockResolvedValueOnce([]);
    const root = renderWorkbench(container);
    await waitForText(container, "No COI assignments yet");

    clickButton(container, "Seed demo");
    await flushReact();

    expect(coiApiMock.seedDemo).toHaveBeenCalledWith("company-1");
    root.unmount();
  });

  it("renders assignment workflow state and calls primary COI actions", async () => {
    const root = renderWorkbench(container);
    await waitForText(container, "Northstar Electrical LLC");
    await waitForText(container, "Waiver endorsement is missing.");

    clickButton(container, "Save evidence");
    await flushReact();
    expect(coiApiMock.upsertDocument).toHaveBeenCalledWith(
      "company-1",
      "assignment-1",
      expect.objectContaining({ documentName: "Manual demo COI" }),
    );

    clickButton(container, "Run checks");
    await flushReact();
    expect(coiApiMock.runChecks).toHaveBeenCalledWith("company-1", "assignment-1");

    clickButton(container, "Request correction");
    await flushReact();
    expect(coiApiMock.reviewerDecision).toHaveBeenCalledWith(
      "company-1",
      "assignment-1",
      expect.objectContaining({ decision: "needs_changes" }),
    );

    clickButton(container, "Approve 14-day exception");
    await flushReact();
    expect(coiApiMock.createException).toHaveBeenCalledWith(
      "company-1",
      "assignment-1",
      expect.objectContaining({ reason: expect.stringContaining("Site mobilization") }),
    );

    expect(container.textContent).toContain("Follow up on 1 COI checklist item.");
    expect(container.textContent).toContain("Ran COI checks: needs_review.");
    root.unmount();
  });
});
