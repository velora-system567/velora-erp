import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { ok } from "../../utils/api-response.js";

const router = Router();
router.use(requireAuth);

router.get("/accounts/trial-balance", (req, res) => ok(res, { rows: [] }, "Trial balance"));
router.get("/accounts/profit-loss", (req, res) => ok(res, { rows: [] }, "Profit and loss"));
router.get("/accounts/balance-sheet", (req, res) => ok(res, { rows: [] }, "Balance sheet"));
router.get("/accounts/gstr1-report", (req, res) => ok(res, { rows: [] }, "GSTR-1 report"));
router.get("/accounts/gstr3b-summary", (req, res) => ok(res, { rows: [] }, "GSTR-3B summary"));
router.get("/accounts/debtor-aging", (req, res) => ok(res, { rows: [] }, "Debtor aging"));
router.get("/accounts/creditor-aging", (req, res) => ok(res, { rows: [] }, "Creditor aging"));
router.get("/accounts/cash-book", (req, res) => ok(res, { rows: [] }, "Cash book"));

export default router;
