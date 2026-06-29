import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/api-response.js";
import { createOperationRecord, deleteOperationRecord, listOperationRecords, operationSchema } from "../../utils/operation-records.js";

const router = Router();
router.use(requireAuth);

router.get("/purchase/records", listOperationRecords("PURCHASE"));
router.post("/purchase/records", validate(operationSchema), createOperationRecord("PURCHASE"));
router.delete("/purchase/records/:id", deleteOperationRecord("PURCHASE"));
router.post("/purchase-orders/:id/create-grn", (req, res) => ok(res, {}, "GRN creation queued"));
router.post("/grn/:id/approve", (req, res) => ok(res, {}, "GRN approval queued"));
router.post("/vendor-bills/:id/record-payment", (req, res) => ok(res, {}, "Vendor payment recording queued"));
router.get("/purchase/pending-grn-report", (req, res) => ok(res, { rows: [] }, "Pending GRN report"));
router.get("/vendors/:id/ledger", (req, res) => ok(res, { rows: [] }, "Vendor ledger"));

export default router;
