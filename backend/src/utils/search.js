/**
 * Global Search — Unified search across all ERP modules.
 *
 * Search scope: customers, products/items, invoices, orders,
 * employees, vendors, GST numbers, phone numbers, emails,
 * item codes, serial numbers, and document numbers.
 */
import { getPrisma } from "../config/db.js";

const SEARCH_LIMIT = 10;

/**
 * Perform a global search across all modules.
 */
export async function globalSearch(req, query) {
  if (!query || query.trim().length < 2) {
    return { results: [], total: 0 };
  }

  const term = query.trim();
  const { tenantId, companyId } = req;
  const prisma = getPrisma();
  const results = [];

  // ─── 1. Search Customers ────────────────────────────────────────────
  try {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId, companyId, isDeleted: false,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { gstin: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, gstin: true, phone: true },
      take: SEARCH_LIMIT,
    });
    for (const c of customers) {
      results.push({
        id: c.id,
        type: "customer",
        label: c.name,
        description: c.gstin || c.phone || "Customer",
        url: `/sales?customerId=${c.id}`,
      });
    }
  } catch { /* skip */ }

  // ─── 2. Search Items/Products ───────────────────────────────────────
  try {
    const items = await prisma.item.findMany({
      where: {
        tenantId, companyId, isDeleted: false,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { itemCode: { contains: term, mode: "insensitive" } },
          { hsnCode: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, itemCode: true, hsnCode: true },
      take: SEARCH_LIMIT,
    });
    for (const i of items) {
      results.push({
        id: i.id,
        type: "product",
        label: i.name,
        description: `${i.itemCode || ""} ${i.hsnCode ? `(HSN: ${i.hsnCode})` : ""}`.trim() || "Product",
        url: `/inventory/products?itemId=${i.id}`,
      });
    }
  } catch { /* skip */ }

  // ─── 3. Search Business Documents (Orders, Invoices, Quotations) ────
  try {
    const docs = await prisma.businessDocument.findMany({
      where: {
        tenantId, companyId, isDeleted: false,
        documentNo: { contains: term, mode: "insensitive" },
      },
      select: { id: true, documentNo: true, documentType: true, status: true, totalAmount: true },
      take: SEARCH_LIMIT,
      orderBy: { createdAt: "desc" },
    });
    for (const d of docs) {
      const typeLabel = d.documentType?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const module = d.documentType === "QUOTATION" ? "quotations"
        : d.documentType === "SALES_ORDER" ? "orders"
        : d.documentType === "INVOICE" ? "invoices"
        : "sales";
      results.push({
        id: d.id,
        type: "document",
        label: `${typeLabel} ${d.documentNo || ""}`,
        description: `Status: ${d.status}`,
        url: `/${module}`,
      });
    }
  } catch { /* skip */ }

  // ─── 4. Search Vendors ──────────────────────────────────────────────
  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        tenantId, companyId, isDeleted: false,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { gstin: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, gstin: true, phone: true },
      take: SEARCH_LIMIT,
    });
    for (const v of vendors) {
      results.push({
        id: v.id,
        type: "vendor",
        label: v.name,
        description: v.gstin || v.phone || "Vendor",
        url: `/purchase?vendorId=${v.id}`,
      });
    }
  } catch { /* skip */ }

  // ─── 5. Search Users/Employees ──────────────────────────────────────
  try {
    const users = await prisma.user.findMany({
      where: {
        tenantId, isDeleted: false,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true, phone: true },
      take: SEARCH_LIMIT,
    });
    for (const u of users) {
      results.push({
        id: u.id,
        type: "user",
        label: u.name,
        description: u.email || u.phone || "User",
        url: `/settings?userId=${u.id}`,
      });
    }
  } catch { /* skip */ }

  // ─── 6. Search Payment Receipts ─────────────────────────────────────
  try {
    const receipts = await prisma.payment.findMany({
      where: {
        tenantId, companyId, isDeleted: false,
        paymentNumber: { contains: term, mode: "insensitive" },
      },
      select: { id: true, paymentNumber: true, amount: true, mode: true },
      take: SEARCH_LIMIT,
    });
    for (const r of receipts) {
      results.push({
        id: r.id,
        type: "receipt",
        label: `Receipt ${r.paymentNumber}`,
        description: `₹${(r.amount / 100).toFixed(2)} via ${r.mode}`,
        url: "/sales",
      });
    }
  } catch { /* skip */ }

  // ─── 7. Search Leads (by name, phone, email) ────────────────────────
  try {
    const leads = await prisma.lead.findMany({
      where: {
        tenantId, companyId, isDeleted: false,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, phone: true, status: true },
      take: SEARCH_LIMIT,
    });
    for (const l of leads) {
      results.push({
        id: l.id,
        type: "lead",
        label: l.name,
        description: `${l.phone || ""} (${l.status})`.trim(),
        url: "/sales",
      });
    }
  } catch { /* skip */ }

  return { results, total: results.length };
}
