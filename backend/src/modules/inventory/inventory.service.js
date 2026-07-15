/**
 * Velora ERP — Inventory Engine
 * Implements FIFO batch consumption, stock ledger writes,
 * stock transfers, adjustments, and balance queries.
 */
import { Decimal } from "@prisma/client/runtime/library";

// ─── Stock Balance ────────────────────────────────────────────────────────────

export async function getStockBalance(tx, { tenantId, itemId, warehouseId }) {
  // Sum all non-deleted ledger entries
  const result = await tx.stockLedger.aggregate({
    where: { tenantId, itemId, warehouseId, isDeleted: false },
    _sum: { quantity: true, value: true },
  });
  return {
    quantity: Number(result._sum.quantity || 0),
    valuePaise: Number(result._sum.value || 0),
  };
}

export async function getStockBalances(tx, { tenantId, companyId, warehouseId }) {
  const ledger = await tx.stockLedger.groupBy({
    by: ["itemId", "warehouseId"],
    where: { tenantId, companyId, ...(warehouseId ? { warehouseId } : {}), isDeleted: false },
    _sum: { quantity: true, value: true },
  });
  return ledger.map((row) => ({
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    quantity: Number(row._sum.quantity || 0),
    valuePaise: Number(row._sum.value || 0),
  }));
}

// ─── FIFO Consumption ────────────────────────────────────────────────────────

/**
 * Consumes stock using FIFO batch ordering.
 * Debits the stock ledger and updates batch remainders.
 * Returns the weighted average cost per unit consumed (in paise).
 */
export async function consumeFifo(tx, { tenantId, companyId, branchId, itemId, warehouseId, quantity, referenceId, referenceType, userId }) {
  let remaining = Number(quantity);
  let totalCostPaise = 0;

  // Get FIFO batches (oldest first)
  const batches = await tx.stockBatch.findMany({
    where: { tenantId, itemId, warehouseId, isDeleted: false, qtyRemaining: { gt: 0 } },
    orderBy: { receivedDate: "asc" },
  });

  const currentBalance = batches.reduce((s, b) => s + Number(b.qtyRemaining), 0);
  if (currentBalance < remaining) {
    const e = new Error(`Insufficient stock for item. Available: ${currentBalance}, Required: ${remaining}`);
    e.statusCode = 422;
    throw e;
  }

  for (const batch of batches) {
    if (remaining <= 0) break;
    const consume = Math.min(Number(batch.qtyRemaining), remaining);
    totalCostPaise += Math.round(consume * Number(batch.costRate));
    remaining -= consume;

    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { qtyRemaining: { decrement: consume } },
    });
  }

  const totalConsumed = Number(quantity);
  const avgRate = totalConsumed > 0 ? Math.round(totalCostPaise / totalConsumed) : 0;

  // Write stock ledger debit entry
  await tx.stockLedger.create({
    data: {
      tenantId, companyId, branchId: branchId || null,
      itemId, warehouseId,
      transactionType: referenceType === "DELIVERY_NOTE" ? "SALE" :
                       referenceType === "PRODUCTION" ? "PRODUCTION_OUT" : "ADJUSTMENT",
      quantity: -totalConsumed,
      rate: avgRate,
      value: -totalCostPaise,
      referenceId: referenceId || null,
      referenceType: referenceType || null,
      createdBy: userId, updatedBy: userId,
    },
  });

  return { avgRate, totalCostPaise };
}

// ─── Stock Credit (inbound) ──────────────────────────────────────────────────

export async function creditStock(tx, { tenantId, companyId, branchId, itemId, warehouseId, quantity, costRate, referenceId, referenceType, batchNumber, expiryDate, userId }) {
  const qty = Number(quantity);
  const rate = Number(costRate);
  const value = Math.round(qty * rate);

  // Create batch for FIFO
  await tx.stockBatch.create({
    data: {
      tenantId, companyId, itemId, warehouseId,
      batchNumber: batchNumber || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      costRate: rate,
      qtyIn: qty,
      qtyRemaining: qty,
      referenceId: referenceId || null,
      referenceType: referenceType || null,
    },
  });

  // Write ledger credit
  const txType = referenceType === "GRN" ? "PURCHASE" :
                 referenceType === "PRODUCTION" ? "PRODUCTION_IN" :
                 referenceType === "OPENING" ? "OPENING" : "ADJUSTMENT";

  await tx.stockLedger.create({
    data: {
      tenantId, companyId, branchId: branchId || null,
      itemId, warehouseId,
      transactionType: txType,
      quantity: qty,
      rate,
      value,
      referenceId: referenceId || null,
      referenceType: referenceType || null,
      createdBy: userId, updatedBy: userId,
    },
  });

  return { rate, value };
}

// ─── Debit for Sale ──────────────────────────────────────────────────────────

export async function debitStockForSale(tx, params) {
  return consumeFifo(tx, { ...params, referenceType: "DELIVERY_NOTE" });
}

// ─── GRN Stock Credit ────────────────────────────────────────────────────────

export async function creditStockFromGrn(tx, req, grn, lines) {
  for (const line of lines) {
    if (Number(line.acceptedQty) <= 0) continue;
    await creditStock(tx, {
      tenantId: req.tenantId,
      companyId: req.companyId,
      branchId: req.branchId,
      itemId: line.itemId,
      warehouseId: grn.warehouseId,
      quantity: line.acceptedQty,
      costRate: line.rate,
      referenceId: grn.id,
      referenceType: "GRN",
      batchNumber: line.batchNumber || null,
      expiryDate: line.expiryDate || null,
      userId: req.user.sub,
    });
  }
}

// ─── Stock Transfer ──────────────────────────────────────────────────────────

export async function processStockTransfer(tx, req, { itemId, fromWarehouseId, toWarehouseId, quantity, referenceId }) {
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;
  const qty = Number(quantity);

  // Consume FIFO from source
  const { avgRate, totalCostPaise } = await consumeFifo(tx, {
    tenantId, companyId, branchId, itemId,
    warehouseId: fromWarehouseId,
    quantity: qty,
    referenceId, referenceType: "TRANSFER",
    userId,
  });

  // Override ledger entry type to TRANSFER_OUT
  // (consumeFifo wrote ADJUSTMENT; update it)
  const lastLedger = await tx.stockLedger.findFirst({
    where: { tenantId, itemId, warehouseId: fromWarehouseId, referenceId },
    orderBy: { createdAt: "desc" },
  });
  if (lastLedger) {
    await tx.stockLedger.update({ where: { id: lastLedger.id }, data: { transactionType: "TRANSFER_OUT" } });
  }

  // Credit to destination at same cost
  await tx.stockBatch.create({
    data: {
      tenantId, companyId, itemId,
      warehouseId: toWarehouseId,
      costRate: avgRate,
      qtyIn: qty,
      qtyRemaining: qty,
      referenceId: referenceId || null,
      referenceType: "TRANSFER",
    },
  });

  await tx.stockLedger.create({
    data: {
      tenantId, companyId, branchId: branchId || null,
      itemId,
      warehouseId: toWarehouseId,
      transactionType: "TRANSFER_IN",
      quantity: qty,
      rate: avgRate,
      value: totalCostPaise,
      referenceId: referenceId || null,
      referenceType: "TRANSFER",
      createdBy: userId, updatedBy: userId,
    },
  });
}

// ─── Stock Adjustment ────────────────────────────────────────────────────────

export async function processStockAdjustment(tx, req, { itemId, warehouseId, adjustmentQty, reason, costRate }) {
  const { tenantId, companyId, branchId } = req;
  const userId = req.user.sub;
  const qty = Number(adjustmentQty);

  if (qty > 0) {
    await creditStock(tx, {
      tenantId, companyId, branchId, itemId, warehouseId,
      quantity: qty, costRate: costRate || 0,
      referenceType: "ADJUSTMENT", userId,
    });
  } else if (qty < 0) {
    await consumeFifo(tx, {
      tenantId, companyId, branchId, itemId, warehouseId,
      quantity: Math.abs(qty),
      referenceType: "ADJUSTMENT", userId,
    });
  }

  // Record adjustment
  await tx.stockAdjustment.create({
    data: {
      tenantId, companyId, branchId: branchId || null,
      itemId, warehouseId,
      quantity: qty,
      reason,
      createdBy: userId, updatedBy: userId,
    },
  });
}

// ─── Low Stock Report ────────────────────────────────────────────────────────

export async function getLowStockAlerts(req) {
  const prisma = (await import("../../config/db.js")).getPrisma();
  const { tenantId, companyId } = req;

  const items = await prisma.item.findMany({
    where: { tenantId, companyId, isDeleted: false, reorderLevel: { not: null } },
  });

  const alerts = [];
  for (const item of items) {
    const ledger = await prisma.stockLedger.aggregate({
      where: { tenantId, itemId: item.id, isDeleted: false },
      _sum: { quantity: true },
    });
    const balance = Number(ledger._sum.quantity || 0);
    if (balance <= Number(item.reorderLevel || 0)) {
      alerts.push({
        itemId: item.id,
        itemCode: item.itemCode,
        name: item.name,
        currentStock: balance,
        reorderLevel: Number(item.reorderLevel),
        reorderQuantity: Number(item.reorderQuantity || 0),
        deficit: Number(item.reorderLevel) - balance,
      });
    }
  }
  return alerts;
}
