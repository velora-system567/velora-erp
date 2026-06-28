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
import { ok } from "./utils/api-response.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (req, res) => ok(res, { status: "ok" }, "Velora ERP API is running"));
app.use("/api/auth", authRoutes);
app.use("/api", coreRoutes);
app.use("/api", masterRoutes);
app.use("/api", salesRoutes);
app.use("/api", purchaseRoutes);
app.use("/api", inventoryRoutes);
app.use("/api", accountsRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);
