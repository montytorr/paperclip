import { describe, expect, it } from "vitest";
import type { CoiPolicyInput } from "@paperclipai/shared";

import { evaluateCoiRules } from "./coi.js";

function requirement(overrides: Record<string, unknown>) {
  return {
    id: "req-id",
    companyId: "company-id",
    requirementSetId: "set-id",
    requirementKey: "req",
    title: "Requirement",
    kind: "coverage",
    coverageKind: null,
    minimumLimit: null,
    endorsementKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never;
}

describe("evaluateCoiRules", () => {
  it("passes present coverage with valid expiration and sufficient limits", () => {
    const policies: CoiPolicyInput[] = [
      {
        coverageKind: "general_liability",
        expirationDate: "2027-06-30",
        limitAmount: 1_000_000,
      },
    ];

    const findings = evaluateCoiRules({
      requirements: [
        requirement({
          requirementKey: "gl-1m",
          title: "GL $1M",
          kind: "coverage",
          coverageKind: "general_liability",
          minimumLimit: 1_000_000,
        }),
      ],
      policies,
      endorsements: [],
      now: new Date("2026-06-18T00:00:00.000Z"),
    });

    expect(findings).toMatchObject([{ requirementKey: "gl-1m", status: "pass" }]);
  });

  it("fails missing coverage, expired policies, and insufficient limits", () => {
    const findings = evaluateCoiRules({
      requirements: [
        requirement({
          requirementKey: "auto",
          title: "Auto",
          kind: "coverage",
          coverageKind: "auto_liability",
          minimumLimit: 1_000_000,
        }),
        requirement({
          requirementKey: "gl",
          title: "GL",
          kind: "coverage",
          coverageKind: "general_liability",
          minimumLimit: 1_000_000,
        }),
        requirement({
          requirementKey: "wc",
          title: "WC",
          kind: "coverage",
          coverageKind: "workers_comp",
        }),
      ],
      policies: [
        { coverageKind: "general_liability", expirationDate: "2026-01-01", limitAmount: 2_000_000 },
        { coverageKind: "workers_comp", expirationDate: "2027-01-01", limitAmount: 100_000 },
      ],
      endorsements: [],
      now: new Date("2026-06-18T00:00:00.000Z"),
    });

    expect(findings.map((finding) => [finding.requirementKey, finding.status, finding.detail])).toEqual([
      ["auto", "fail", "Required coverage is missing."],
      ["gl", "fail", "Policy is expired."],
      ["wc", "pass", "Coverage is present and meets the deterministic requirement."],
    ]);
  });

  it("routes missing endorsement evidence to human review", () => {
    const findings = evaluateCoiRules({
      requirements: [
        requirement({
          requirementKey: "ai",
          title: "Additional insured",
          kind: "endorsement",
          endorsementKey: "additional_insured",
        }),
        requirement({
          requirementKey: "wos",
          title: "Waiver",
          kind: "endorsement",
          endorsementKey: "waiver_of_subrogation",
        }),
      ],
      policies: [],
      endorsements: [{ endorsementKey: "additional_insured", present: true }],
      now: new Date("2026-06-18T00:00:00.000Z"),
    });

    expect(findings).toMatchObject([
      { requirementKey: "ai", status: "pass" },
      { requirementKey: "wos", status: "needs_review", severity: "warning" },
    ]);
  });
});
