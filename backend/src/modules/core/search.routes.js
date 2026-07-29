/**
 * Global Search Route
 */
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { globalSearch } from "../../utils/search.js";

const router = Router();

router.get("/search", requireAuth, asyncHandler(async (req, res) => {
  const q = req.query.q || "";
  const results = await globalSearch(req, q);
  return ok(res, results, "Search results");
}));

export default router;
