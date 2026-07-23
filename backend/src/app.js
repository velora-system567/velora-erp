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

// Core (company, branches, users, products, audit)
app.use("/api", coreRoutes);

// Master data (items, customers, vendors, COA, etc.)
app.use("/api", masterRoutes);

// Sales (leads, quotations, SO, DN, invoices, receipts)
app.use("/api", salesRoutes);

// Purchase (PR, RFQ, PO, GRN, vendor bills, payments)
app.use("/api", purchaseRoutes);

// Inventory (stock ledger, transfers, adjustments)
app.use("/api", inventoryRoutes);

// Accounts (COA, journal entries, reports, GST)
app.use("/api", accountsRoutes);

// Dashboard KPIs
app.use("/api/dashboard", dashboardRoutes);

// Manufacturing (BOM, production orders, work orders, machines, maintenance, QC)
app.use("/api", manufacturingRoutes);

// CRM (customer pipeline, 360° view, search, activities)
app.use("/api", crmRoutes);

app.use(notFound);
app.use(errorHandler);
