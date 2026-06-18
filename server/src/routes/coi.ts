import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createCoiAssignmentSchema,
  createCoiExceptionSchema,
  createCoiProjectSchema,
  createCoiSubcontractorSchema,
  reviewerDecisionSchema,
  updateCoiAssignmentSchema,
  updateCoiProjectSchema,
  updateCoiSubcontractorSchema,
  upsertCoiDocumentSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { coiService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

export function coiRoutes(db: Db) {
  const router = Router();
  const svc = coiService(db);

  router.post("/coi/companies/:companyId/demo-seed", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.seedDemo(companyId));
  });

  router.get("/coi/companies/:companyId/board", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.listBoard(companyId));
  });

  router.post("/coi/companies/:companyId/projects", validate(createCoiProjectSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.status(201).json(await svc.createProject(companyId, req.body));
  });

  router.patch("/coi/companies/:companyId/projects/:projectId", validate(updateCoiProjectSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.updateProject(companyId, req.params.projectId as string, req.body));
  });

  router.post("/coi/companies/:companyId/subcontractors", validate(createCoiSubcontractorSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.status(201).json(await svc.createSubcontractor(companyId, req.body));
  });

  router.patch(
    "/coi/companies/:companyId/subcontractors/:subcontractorId",
    validate(updateCoiSubcontractorSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await svc.updateSubcontractor(companyId, req.params.subcontractorId as string, req.body));
    },
  );

  router.post("/coi/companies/:companyId/assignments", validate(createCoiAssignmentSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.status(201).json(await svc.createAssignment(companyId, req.body));
  });

  router.get("/coi/companies/:companyId/assignments/:assignmentId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.getAssignmentDetail(companyId, req.params.assignmentId as string));
  });

  router.patch(
    "/coi/companies/:companyId/assignments/:assignmentId",
    validate(updateCoiAssignmentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await svc.updateAssignment(companyId, req.params.assignmentId as string, req.body));
    },
  );

  router.post(
    "/coi/companies/:companyId/assignments/:assignmentId/document",
    validate(upsertCoiDocumentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await svc.upsertDocument(companyId, req.params.assignmentId as string, req.body));
    },
  );

  router.post("/coi/companies/:companyId/assignments/:assignmentId/run-checks", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.runChecks(companyId, req.params.assignmentId as string));
  });

  router.post(
    "/coi/companies/:companyId/assignments/:assignmentId/reviewer-decision",
    validate(reviewerDecisionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await svc.recordReviewerDecision(companyId, req.params.assignmentId as string, req.body));
    },
  );

  router.post(
    "/coi/companies/:companyId/assignments/:assignmentId/exceptions",
    validate(createCoiExceptionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.status(201).json(await svc.createException(companyId, req.params.assignmentId as string, req.body));
    },
  );

  return router;
}
