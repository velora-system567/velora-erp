import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/api-response.js";
import { createOperationRecord, deleteOperationRecord, listOperationRecords, operationSchema } from "../../utils/operation-records.js";

const router = Router();
router.use(requireAuth);

router.get("/sales/records", listOperationRecords("SALES"));
router.post("/sales/records", validate(operationSchema), createOperationRecord("SALES"));
router.delete("/sales/records/:id", deleteOperationRecord("SALES"));
router.get("/sales/outstanding-report", (req, res) => ok(res, { rows: [] }, "Outstanding report"));
router.get("/sales/collection-report", (req, res) => ok(res, { rows: [] }, "Collection report"));
router.get("/customers/:id/ledger", (req, res) => ok(res, { rows: [] }, "Customer ledger"));
router.post("/quotations/:id/convert-to-order", (req, res) => ok(res, {}, "Quotation conversion queued"));
router.post("/sales-orders/:id/create-delivery-challan", (req, res) => ok(res, {}, "Delivery challan creation queued"));
router.post("/invoices/:id/record-payment", (req, res) => ok(res, {}, "Payment recording queued"));

export default router;
