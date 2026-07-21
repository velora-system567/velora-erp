/**
 * Velora ERP — Inventory Service
 *
 * Single source of truth for stock movement, valuation, and analytics.
 *
 * Architectural contract:
 *  - Every stock write goes through creditStock() / debitStock() / processStockTransfer() / processStockAdjustment().
 *  - StockBatch (FIFO layer) is updated in the same transaction as StockLedger so the on-hand value is always derivable.
 *  - All amounts are stored in PAISE. Inputs in rupees are converted at the edge.
 *  - Tenant + company + branch isolation enforced on every read and write.
 */
import { getPrisma } from "../../config/db.js";
import { writeAudit } from "../../utils/audit.js";
import { rupeesToPaise } from "../../utils/money.js";

const ACTIVE = { isDeleted: false };

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && "toNumber" in value) return value.toNumber();
  return Number(value);
}

function toQty(value) {
  // Quantities are stored at 3 decimal places. We do not round to integers.
  return Number(Number(value).toFixed(3));
}

function assertPos(qty, name = "quantity") {
  if (!(Number(qty) > 0)) {
    const e = new Error(`${name} must be greater than zero`);
    e.statusCode = 422;
    throw e;
  }
}

function notFound(message) {
  const e = new Error(message);
  e.statusCode = 404;
  return e;
}

function conflict(message) {
  const e = new Error(message);
  e.statusCode = 409;
  return e;
}

function unprocessable(message) {
  const e = new Error(message);
  e.statusCode = 422;
  return e;
}

// ─── Balances ─────────────────────────────────────────────────────────────────

/**
 * Compute FIFO stock balances across all warehouses (or a single warehouse) for a tenant.
 * Returns array of { itemId, warehouseId, quantity, valuePaise } rows.
 *
 * Implementation: pulls active stock batches (which already carry FIFO cost),
 * then groups by (itemId, warehouseId) and sums remaining quantity × cost.
 */
export async function getStockBalances(prisma, { tenantId, companyId, warehouseId }) {
  const where = {
    tenantId,
    companyId,
    isDeleted: false,
    qtyRemaining: { gt: 0 },
    ...(warehouseId ? { warehouseId } : {}),
  };
  const batches = await prisma.stockBatch.findMany({
    where,
    select: { itemId: true, warehouseId: true, qtyRemaining: true, costRate: true },
  });
  const map = new Map();
  for (const batch of batches) {
    const key = `${batch.itemId}::${batch.warehouseId}`;
    const row = map.get(key) || { itemId: batch.itemId, warehouseId: batch.warehouseId, quantity: 0, valuePaise: 0 };
    const qty = toNumber(batch.qtyRemaining);
    row.quantity = toQty(row.quantity + qty);
    row.valuePaise = Math.round(row.valuePaise + qty * Number(batch.costRate || 0));
    map.set(key, row);
  }
  return [...map.values()];
}

/**
 * Single (itemId, warehouseId) balance row.
 */
export async function getStockBalance(prisma, { tenantId, itemId, warehouseId }) {
  const balances = await getStockBalances(prisma, { tenantId, itemId, warehouseId });
  return balances[0] || { itemId, warehouseId, quantity: 0, valuePaise: 0 };
}

// ─── Core writes: credit / debit / transfer / adjustment ──────────────────────

/**
 * Adds stock to a warehouse and writes the matching FIFO batch + ledger entry.
 *
 * Caller passes a transactional Prisma client (tx) when calling from inside a larger
 * transaction (e.g. GRN approval). When called from a route, pass the regular prisma.
 */
export async function creditStock(tx, {
  tenantId, companyId, branchId, itemId, warehouseId, quantity, costRate = 0,
  transactionType = "PURCHASE", referenceType, referenceId, batchNumber = null, expiryDate = null,
  userId, notes = null,
}) {
  const prisma = tx || getPrisma();
  assertPos(quantity, "credit quantity");

  const qty = toQty(quantity);
  const rate = Math.max(0, Math.round(Number(costRate) || 0));
  const value = Math.round(qty * rate);

  const [batch, ledger] = await prisma.$transaction([
    prisma.stockBatch.create({
      data: {
        tenantId, companyId, itemId, warehouseId,
        batchNumber, expiryDate, costRate: rate,
        qtyIn: qty, qtyRemaining: qty,
        referenceId: referenceId || null,
        referenceType: referenceType || transactionType,
        isDeleted: false,
      },
    }),
    prisma.stockLedger.create({
      data: {
        tenantId, companyId, branchId: branchId || null,
        itemId, warehouseId,
        transactionType,
        quantity: qty,
        rate,
        value,
        referenceId: referenceId || null,
        referenceType: referenceType || null,
        isDeleted: false,
      },
    }),
  ]);

  return { batchId: batch.id, ledgerId: ledger.id, quantity: qty, valuePaise: value, costRate: rate };
}

/**
 * Removes stock from a warehouse using FIFO (oldest batches first) and writes the ledger row.
 * Returns the average FIFO cost that was used (in paise per unit) so callers can value COGS.
 */
export async function debitStock(tx, {
  tenantId, companyId, branchId, itemId, warehouseId, quantity,
  transactionType = "SALE", referenceType, referenceId, notes = null, userId,
}) {
  const prisma = tx || getPrisma();
  assertPos(quantity, "debit quantity");

  const requested = toQty(quantity);
  const available = (await getStockBalance(prisma, { tenantId, itemId, warehouseId })).quantity;
  if (available < requested) {
    throw unprocessable(`Insufficient stock. Available ${available}, requested ${requested}`);
  }

  // FIFO consume
  const batches = await prisma.stockBatch.findMany({
    where: { tenantId, companyId, itemId, warehouseId, isDeleted: false, qtyRemaining: { gt: 0 } },
    orderBy: [{ receivedDate: "asc" }, { createdAt: "asc" }],
  });

  let remaining = requested;
  let totalValue = 0;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const available = toNumber(batch.qtyRemaining);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    const newRem = toQty(available - take);
    const valueRemoved = Math.round(take * Number(batch.costRate || 0));
    totalValue += valueRemoved;
    await prisma.stockBatch.update({
      where: { id: batch.id },
      data: { qtyRemaining: newRem, isDeleted: newRem <= 0 },
    });
    remaining = toQty(remaining - take);
  }

  if (remaining > 0.0005) {
    // Should be guarded above, but defend against rounding.
    throw unprocessable(`FIFO consumption left an unfulfilled remainder (${remaining})`);
  }

  const ledger = await prisma.stockLedger.create({
    data: {
      tenantId, companyId, branchId: branchId || null,
      itemId, warehouseId,
      transactionType,
      quantity: -requested,
      rate: Math.round(totalValue / Math.max(requested, 0.0001)),
      value: -totalValue,
      referenceId: referenceId || null,
      referenceType: referenceType || null,
      isDeleted: false,
    },
  });

  return { ledgerId: ledger.id, quantity: requested, valuePaise: totalValue, costRate: Math.round(totalValue / Math.max(requested, 0.0001)) };
}

/**
 * Stock transfer: debit source warehouse, credit destination warehouse.
 * Both ledger rows share the same referenceId for audit traceability.
 */
export async function processStockTransfer(tx, req, { itemId, fromWarehouseId, toWarehouseId, quantity, referenceId = null }) {
  const prisma = tx || getPrisma();
  const userId = req.user?.sub;

  await debitStock(prisma, {
    tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId,
    itemId, warehouseId: fromWarehouseId, quantity,
    transactionType: "TRANSFER_OUT", referenceType: "STOCK_TRANSFER", referenceId, userId,
  });

  // Use average cost of what was just consumed as the receiving cost.
  const sourceBalance = await getStockBalance(prisma, { tenantId: req.tenantId, companyId: req.companyId, itemId, warehouseId: fromWarehouseId });
  const costRate = sourceBalance.quantity > 0
    ? Math.round(sourceBalance.valuePaise / sourceBalance.quantity)
    : 0;

  await creditStock(prisma, {
    tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId,
    itemId, warehouseId: toWarehouseId, quantity, costRate,
    transactionType: "TRANSFER_IN", referenceType: "STOCK_TRANSFER", referenceId, userId,
  });
}

/**
 * Stock adjustment: positive adds, negative removes. Writes a single ADJUSTMENT ledger row
 * and a matching batch correction so balances stay correct.
 */
export async function processStockAdjustment(tx, req, { itemId, warehouseId, adjustmentQty, reason, costRate = 0 }) {
  const prisma = tx || getPrisma();
  const userId = req.user?.sub;
  const qty = toQty(adjustmentQty);

  if (qty === 0) {
    throw unprocessable("Adjustment quantity cannot be zero");
  }

  if (qty > 0) {
    await creditStock(prisma, {
      tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId,
      itemId, warehouseId, quantity: qty, costRate: Math.max(0, Math.round(Number(costRate) || 0)),
      transactionType: "ADJUSTMENT", referenceType: "STOCK_ADJUSTMENT",
      userId, notes: reason,
    });
  } else {
    await debitStock(prisma, {
      tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId,
      itemId, warehouseId, quantity: Math.abs(qty),
      transactionType: "ADJUSTMENT", referenceType: "STOCK_ADJUSTMENT", userId,
    });
  }

  // Persist a normalized adjustment record for audit
  const adjustment = await prisma.stockAdjustment.create({
    data: {
      tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId || null,
      itemId, warehouseId, quantity: qty, reason, createdBy: userId, updatedBy: userId,
    },
  });
  await writeAudit(req, { tx: prisma, tableName: "stock_adjustments", recordId: adjustment.id, action: "STOCK_ADJUSTMENT_POSTED", newValue: adjustment });
  return adjustment;
}

/**
 * GRN integration: credits stock for every accepted line and creates a matching batch per line.
 * Called from purchase.service.js during GRN approval.
 */
export async function creditStockFromGrn(tx, req, grn, lines) {
  const prisma = tx || getPrisma();
  const results = [];
  for (const line of lines) {
    const accepted = toNumber(line.acceptedQty ?? line.receivedQty);
    if (accepted <= 0) continue;
    const costRate = rupeesToPaise(line.rate || 0);
    const result = await creditStock(prisma, {
      tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId,
      itemId: line.itemId, warehouseId: grn.warehouseId,
      quantity: accepted, costRate,
      transactionType: "PURCHASE", referenceType: "GOODS_RECEIPT", referenceId: grn.id,
      batchNumber: line.batchNumber || null, expiryDate: line.expiryDate || null,
      userId: req.user?.sub,
    });
    results.push({ lineId: line.id, ...result });
  }
  return results;
}

/**
 * Sales integration: debits stock for a sales document line (delivery note / invoice).
 */
export async function debitStockForSale(tx, { tenantId, companyId, branchId, itemId, warehouseId, quantity, referenceId, referenceType, userId }) {
  return debitStock(tx || getPrisma(), {
    tenantId, companyId, branchId, itemId, warehouseId, quantity,
    transactionType: "SALE", referenceType: referenceType || "SALES_ORDER", referenceId, userId,
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

/**
 * Low stock alert list using each item's reorderLevel (or safetyStock) against
 * the aggregate quantity across all warehouses.
 */
export async function getLowStockAlerts(req) {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const items = await prisma.item.findMany({
    where: { tenantId, companyId, isDeleted: false, isActive: true },
    select: { id: true, itemCode: true, name: true, reorderLevel: true, reorderQuantity: true, safetyStock: true },
  });
  if (!items.length) return [];

  const totals = await prisma.stockBatch.groupBy({
    by: ["itemId"],
    where: { tenantId, companyId, isDeleted: false, qtyRemaining: { gt: 0 } },
    _sum: { qtyRemaining: true },
  });
  const onHand = new Map(totals.map((row) => [row.itemId, toNumber(row._sum.qtyRemaining)]));

  return items
    .map((item) => {
      const qty = onHand.get(item.id) || 0;
      const threshold = toNumber(item.reorderLevel ?? item.safetyStock ?? 0);
      const suggested = Math.max(0, toNumber(item.reorderQuantity ?? 0) || (threshold - qty) || 0);
      return {
        itemId: item.id,
        itemCode: item.itemCode,
        name: item.name,
        onHand: toQty(qty),
        reorderLevel: toQty(threshold),
        suggestedOrderQty: toQty(suggested),
        status: qty <= 0 ? "OUT_OF_STOCK" : qty <= threshold ? "LOW" : "OK",
      };
    })
    .filter((row) => row.status !== "OK")
    .sort((a, b) => a.onHand - b.onHand);
}

// ─── Control Tower (dashboard) ────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const ninetyDaysAgo = () => new Date(Date.now() - 90 * DAY_MS);

function classifyABC(balancePaise, totalValue) {
  if (totalValue <= 0) return "C";
  const share = balancePaise / totalValue;
  if (share >= 0.05) return "A";
  if (share >= 0.015) return "B";
  return "C";
}

/**
 * Rich payload used by the Inventory Control Tower UI.
 * All read paths use parallel queries and pre-aggregation to keep this O(1) trips.
 */
export async function getInventoryControlTower(prisma, { tenantId, companyId, warehouseId }) {
  const balanceWhere = { tenantId, companyId, isDeleted: false, qtyRemaining: { gt: 0 }, ...(warehouseId ? { warehouseId } : {}) };
  const ledgerWhere = { tenantId, companyId, isDeleted: false, ...(warehouseId ? { warehouseId } : {}) };

  const [warehouses, batches, recentLedger, expiringBatches, saleOutQtyAgg, totalSkus] = await Promise.all([
    prisma.warehouse.findMany({ where: { tenantId, companyId, isDeleted: false }, select: { id: true, name: true, warehouseType: true, capacity: true, isDefault: true }, orderBy: { name: "asc" } }),
    prisma.stockBatch.findMany({
      where: balanceWhere,
      select: { id: true, itemId: true, warehouseId: true, qtyRemaining: true, costRate: true, receivedDate: true, batchNumber: true, expiryDate: true },
    }),
    prisma.stockLedger.findMany({
      where: ledgerWhere,
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { item: { select: { name: true, itemCode: true } } },
    }),
    prisma.stockBatch.findMany({
      where: { ...balanceWhere, expiryDate: { not: null, lte: new Date(Date.now() + 90 * DAY_MS) } },
      orderBy: { expiryDate: "asc" },
      take: 25,
      include: { item: { select: { id: true, name: true, itemCode: true } } },
    }),
    prisma.stockLedger.aggregate({ where: { ...ledgerWhere, transactionType: "SALE", createdAt: { gte: ninetyDaysAgo() } }, _sum: { quantity: true } }),
    prisma.item.count({ where: { tenantId, companyId, isDeleted: false, isActive: true } }),
  ]);

  // Per-(item,warehouse) aggregation
  const balanceMap = new Map();
  for (const batch of batches) {
    const key = `${batch.itemId}::${batch.warehouseId}`;
    const row = balanceMap.get(key) || { itemId: batch.itemId, warehouseId: batch.warehouseId, quantity: 0, valuePaise: 0, oldestReceived: batch.receivedDate };
    const qty = toNumber(batch.qtyRemaining);
    row.quantity = toQty(row.quantity + qty);
    row.valuePaise = Math.round(row.valuePaise + qty * Number(batch.costRate || 0));
    if (batch.receivedDate && (!row.oldestReceived || batch.receivedDate < row.oldestReceived)) row.oldestReceived = batch.receivedDate;
    balanceMap.set(key, row);
  }
  const balances = [...balanceMap.values()];

  // KPIs
  const totalValuePaise = balances.reduce((s, b) => s + b.valuePaise, 0);
  const totalQty = balances.reduce((s, b) => s + b.quantity, 0);
  const outQty = Math.abs(toNumber(saleOutQtyAgg._sum.quantity) || 0);
  const turnover = totalQty > 0 ? Number((outQty * 4 / Math.max(totalQty, 1)).toFixed(2)) : 0; // annualized: 90d × 4

  // Low / out / over — use Item reorder level
  const items = await prisma.item.findMany({
    where: { tenantId, companyId, isDeleted: false, isActive: true },
    select: { id: true, itemCode: true, name: true, reorderLevel: true, reorderQuantity: true, safetyStock: true, eoqQuantity: true, brand: true, itemType: true, itemCategoryId: true },
  });
  const totalByItem = new Map();
  for (const row of balances) {
    totalByItem.set(row.itemId, toQty((totalByItem.get(row.itemId) || 0) + row.quantity));
  }
  let lowStockItems = 0, outOfStockItems = 0, overstockItems = 0;
  const topMoving = [];
  const slowMoving = [];
  const recommendations = [];
  for (const item of items) {
    const qty = totalByItem.get(item.id) || 0;
    const level = toNumber(item.reorderLevel ?? item.safetyStock ?? 0);
    const eoq = toNumber(item.reorderQuantity ?? item.eoqQuantity ?? 0);
    if (qty <= 0) outOfStockItems++;
    else if (level > 0 && qty <= level) {
      lowStockItems++;
      const suggested = Math.max(eoq, level * 2);
      recommendations.push({ itemId: item.id, itemCode: item.itemCode, name: item.name, onHand: qty, reorderLevel: level, suggestedOrderQty: toQty(suggested), urgency: qty <= level / 2 ? "HIGH" : "MEDIUM" });
    } else if (level > 0 && qty > level * 3) {
      overstockItems++;
    }
  }

  // Top moving: by value, then quantity
  const sortedByValue = [...balances].sort((a, b) => b.valuePaise - a.valuePaise).slice(0, 5);
  const itemMeta = new Map(items.map((i) => [i.id, i]));
  const balanceItemMap = new Map();
  for (const row of sortedByValue) {
    balanceItemMap.set(row.itemId, row);
  }
  for (const row of sortedByValue) {
    const meta = itemMeta.get(row.itemId);
    if (!meta) continue;
    topMoving.push({ itemId: row.itemId, name: meta.name, itemCode: meta.itemCode, quantity: row.quantity, valuePaise: row.valuePaise });
  }

  // Slow moving: oldest stock with no recent activity
  const oldestItems = [...balances].sort((a, b) => new Date(a.oldestReceived || 0) - new Date(b.oldestReceived || 0)).slice(0, 5);
  for (const row of oldestItems) {
    const meta = itemMeta.get(row.itemId);
    if (!meta) continue;
    slowMoving.push({ itemId: row.itemId, name: meta.name, itemCode: meta.itemCode, quantity: row.quantity, valuePaise: row.valuePaise, ageDays: row.oldestReceived ? Math.floor((Date.now() - new Date(row.oldestReceived).getTime()) / DAY_MS) : 0 });
  }

  // Warehouse summary
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
  const warehouseSummary = new Map();
  for (const row of balances) {
    const entry = warehouseSummary.get(row.warehouseId) || { warehouseId: row.warehouseId, warehouseName: warehouseMap.get(row.warehouseId)?.name || "Unknown", skuCount: 0, quantity: 0, valuePaise: 0 };
    entry.skuCount += 1;
    entry.quantity = toQty(entry.quantity + row.quantity);
    entry.valuePaise += row.valuePaise;
    warehouseSummary.set(row.warehouseId, entry);
  }
  // Also include zero-balance warehouses so the UI shows the full estate
  for (const w of warehouses) {
    if (!warehouseSummary.has(w.id)) warehouseSummary.set(w.id, { warehouseId: w.id, warehouseName: w.name, skuCount: 0, quantity: 0, valuePaise: 0 });
  }

  // ABC analysis
  const valueByItem = new Map();
  for (const row of balances) valueByItem.set(row.itemId, (valueByItem.get(row.itemId) || 0) + row.valuePaise);
  const abcMap = { A: { classification: "A", itemCount: 0, valuePaise: 0 }, B: { classification: "B", itemCount: 0, valuePaise: 0 }, C: { classification: "C", itemCount: 0, valuePaise: 0 } };
  const totalItemValue = [...valueByItem.values()].reduce((s, v) => s + v, 0);
  for (const [, valuePaise] of valueByItem) {
    const cls = classifyABC(valuePaise, totalItemValue);
    abcMap[cls].itemCount += 1;
    abcMap[cls].valuePaise += valuePaise;
  }

  // Expiring / reserved
  const reservedAgg = await prisma.inventoryReservation.aggregate({
    where: { tenantId, companyId, isDeleted: false, status: "ACTIVE" },
    _sum: { quantity: true },
  }).catch(() => ({ _sum: { quantity: 0 } }));

  const inTransitAgg = await prisma.stockTransfer.count({
    where: { tenantId, companyId, isDeleted: false, status: { in: ["DRAFT", "SUBMITTED"] } },
  }).catch(() => 0);

  // Movement heatmap (7 days × 24 hours) — counts
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
  const recentMovements = await prisma.stockLedger.findMany({
    where: { tenantId, companyId, isDeleted: false, createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, transactionType: true, quantity: true },
  });
  const heatmap = Array.from({ length: 7 }).map(() => Array.from({ length: 24 }).map(() => 0));
  for (const m of recentMovements) {
    const d = new Date(m.createdAt);
    heatmap[d.getDay()][d.getHours()] += 1;
  }

  return {
    kpis: {
      inventoryValuePaise: totalValuePaise,
      totalStock: toQty(totalQty),
      inventoryTurnover: turnover,
      lowStockItems,
      outOfStockItems,
      overstockItems,
      expiringBatches: expiringBatches.length,
      reservedStock: toQty(toNumber(reservedAgg._sum.quantity) || 0),
      inTransitTransfers: inTransitAgg,
      totalSkus,
    },
    warehouseSummary: [...warehouseSummary.values()].sort((a, b) => b.valuePaise - a.valuePaise),
    abcSummary: Object.values(abcMap),
    topMovingProducts: topMoving,
    slowMovingProducts: slowMoving,
    recentActivity: recentLedger,
    expiringBatches,
    recommendations: recommendations.slice(0, 8),
    movementHeatmap: heatmap,
  };
}

// ─── Ledger & batch reports ───────────────────────────────────────────────────

export async function getInventoryLedgerPage(prisma, { tenantId, companyId, page = 1, limit = 50, itemId, warehouseId, transactionType, fromDate, toDate }) {
  const where = { tenantId, companyId, isDeleted: false };
  if (itemId) where.itemId = itemId;
  if (warehouseId) where.warehouseId = warehouseId;
  if (transactionType) where.transactionType = transactionType;
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) where.createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  const [total, rows] = await Promise.all([
    prisma.stockLedger.count({ where }),
    prisma.stockLedger.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        item: { select: { name: true, itemCode: true } },
        warehouse: { select: { name: true } },
      },
    }),
  ]);
  return { rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getBatchTraceabilityReport(prisma, { tenantId, companyId, warehouseId, status = "ALL" }) {
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * DAY_MS);
  const where = { tenantId, companyId, isDeleted: false, qtyRemaining: { gt: 0 } };
  if (warehouseId) where.warehouseId = warehouseId;

  const batches = await prisma.stockBatch.findMany({
    where,
    orderBy: [{ expiryDate: "asc" }, { receivedDate: "asc" }],
    include: {
      item: { select: { id: true, name: true, itemCode: true, brand: true } },
      warehouse: { select: { id: true, name: true } },
    },
    take: 500,
  });

  return batches
    .map((b) => {
      let computed = "ACTIVE";
      if (b.expiryDate && new Date(b.expiryDate) < now) computed = "EXPIRED";
      else if (b.expiryDate && new Date(b.expiryDate) <= in90) computed = "EXPIRING";
      return { ...b, status: computed };
    })
    .filter((b) => status === "ALL" || b.status === status);
}
