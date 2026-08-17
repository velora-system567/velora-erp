/**
 * Velora ERP — Frontend Format Utilities
 */

export function formatRupees(paise) {
  if (paise === null || paise === undefined) return "₹0.00";
  const rupees = Number(paise) / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatRupeesCompact(paise) {
  if (paise === null || paise === undefined) return "₹0";
  const n = Math.abs(Number(paise)) / 100;
  const sign = Number(paise) < 0 ? "-" : "";
  if (n >= 1e7) return `${sign}₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${sign}₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${sign}₹${(n / 1e3).toFixed(1)}K`;
  return `${sign}₹${n.toFixed(0)}`;
}

export function number(n) {
  if (n === null || n === undefined) return "0";
  return Number(n).toLocaleString("en-IN");
}

export function businessDocumentStatusLabel(status) {
  const map = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    CLOSED: "Closed",
  };
  return map[status] || status;
}

export function documentTypeLabel(type) {
  const map = {
    QUOTATION: "Quotation",
    SALES_ORDER: "Sales Order",
    DELIVERY_NOTE: "Delivery Note",
    INVOICE: "Invoice",
    PURCHASE_ORDER: "Purchase Order",
    PURCHASE_INVOICE: "Purchase Invoice",
    RECEIPT: "Receipt",
    PAYMENT: "Payment",
  };
  return map[type] || type;
}

export function documentTypeIcon(type) {
  const map = {
    QUOTATION: "📄",
    SALES_ORDER: "📋",
    DELIVERY_NOTE: "🚚",
    INVOICE: "🧾",
    PURCHASE_ORDER: "📋",
    PURCHASE_INVOICE: "🧾",
    RECEIPT: "💳",
    PAYMENT: "💳",
  };
  return map[type] || "📄";
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN");
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
}