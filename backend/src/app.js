import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import coreRoutes from "./modules/core/core.routes.js";
import masterRoutes from "./modules/master/master.routes.js";
import salesRoutes from "./modules/sales/sales.routes.js";
import purchaseRoutes from "./modules/purchase/purchase.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import accountsRoutes from "./modules/accounts/accounts.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import manufacturingRoutes from "./modules/manufacturing/manufacturing.routes.js";
import crmRoutes from "./modules/crm/crm.routes.js";
import wmsRoutes from "./modules/wms/wms.routes.js";
import biRoutes from "./modules/bi/bi.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import hrmsRoutes from "./modules/hrms/hrms.routes.js";
import eamRoutes from "./modules/eam/eam.routes.js";
import platformRoutes from "./modules/platform/platform.routes.js";
import portalRoutes from "./modules/supplier-portal/portal.routes.js";
import flowRoutes from "./modules/flow/flow.routes.js";
import { ok } from "./utils/api-response.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

// Health
app.get("/api/health", (req, res) => ok(res, { status: "ok", version: "1.5.0" }, "Velora ERP API is running"));

// Auth
app.use("/api/auth", authRoutes);

// ─── Named module routes (MUST come before the generic master catch-all) ────
// These have specific prefixes that would otherwise be swallowed by
// masterRoutes' /:resource and /:resource/:id patterns.

// Dashboard KPIs
app.use("/api/dashboard", dashboardRoutes);

// Sales (leads, quotations, SO, DN, invoices, receipts)
app.use("/api", salesRoutes);

// Purchase (PR, RFQ, PO, GRN, vendor bills, payments)
app.use("/api", purchaseRoutes);

// Inventory (stock ledger, transfers, adjustments)
app.use("/api", inventoryRoutes);

// Accounts (COA, journal entries, reports, GST)
app.use("/api", accountsRoutes);

// Manufacturing (BOM, production orders, work orders, machines, maintenance, QC)
app.use("/api", manufacturingRoutes);

// CRM (customer pipeline, 360° view, search, activities)
app.use("/api", crmRoutes);

// WMS (warehouse management, bin locations, movements)
app.use("/api", wmsRoutes);

// HRMS (employees, roles, attendance, payroll)
app.use("/api", hrmsRoutes);

// EAM (enterprise asset management)
app.use("/api", eamRoutes);

// BI (executive dashboard, analytics, insights)
app.use("/api", biRoutes);

// AI Copilot (chat, insights, diagnostics)
app.use("/api", aiRoutes);

// Platform (developer portal, webhooks, API keys)
app.use("/api", platformRoutes);

// Supplier Portal
app.use("/api", portalRoutes);

// Flow (workflow automation)
app.use("/api", flowRoutes);

// Core (company, branches, users, products, audit)
app.use("/api", coreRoutes);

// ─── Generic master data catch-all (MUST be last — /:resource swallows all) ─
// Master data (items, customers, vendors, COA, etc.)
app.use("/api", masterRoutes);

app.use(notFound);
app.use(errorHandler);
