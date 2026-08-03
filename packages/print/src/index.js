/**
 * @velora/print — Centralized Print & PDF Export Service
 *
 * Supports:
 * - Print preview
 * - PDF export (via browser print or html2canvas+jsPDF in future)
 * - Direct printing
 * - Page sizes: A4, A5, Letter, Legal
 * - Orientation: portrait, landscape
 * - Margins configuration
 * - Print templates for all document types
 * - Future: printer selection, Tauri native printing
 */

// ─── Page Sizes ─────────────────────────────────────────────────────

export const PAGE_SIZES = {
  A4: { width: 210, height: 297, label: "A4 (210 × 297mm)" },
  A5: { width: 148, height: 210, label: "A5 (148 × 210mm)" },
  LETTER: { width: 216, height: 279, label: "Letter (8.5 × 11in)" },
  LEGAL: { width: 216, height: 356, label: "Legal (8.5 × 14in)" },
};

export const DEFAULT_MARGINS = {
  top: 15,
  right: 15,
  bottom: 15,
  left: 15,
};

// ─── Document Types ─────────────────────────────────────────────────

export const DOCUMENT_TYPES = {
  INVOICE: { label: "Invoice", prefix: "INV", defaultSize: "A4", defaultOrientation: "portrait" },
  QUOTATION: { label: "Quotation", prefix: "QUO", defaultSize: "A4", defaultOrientation: "portrait" },
  SALES_ORDER: { label: "Sales Order", prefix: "SO", defaultSize: "A4", defaultOrientation: "portrait" },
  PURCHASE_ORDER: { label: "Purchase Order", prefix: "PO", defaultSize: "A4", defaultOrientation: "portrait" },
  PURCHASE_INVOICE: { label: "Purchase Invoice", prefix: "PI", defaultSize: "A4", defaultOrientation: "portrait" },
  DELIVERY_NOTE: { label: "Delivery Note", prefix: "DN", defaultSize: "A4", defaultOrientation: "portrait" },
  GRN: { label: "Goods Receipt Note", prefix: "GRN", defaultSize: "A4", defaultOrientation: "portrait" },
  RECEIPT: { label: "Payment Receipt", prefix: "RCP", defaultSize: "A4", defaultOrientation: "portrait" },
  LABEL: { label: "Product Label", prefix: "LBL", defaultSize: "A4", defaultOrientation: "landscape" },
  BARCODE: { label: "Barcode Label", prefix: "BC", defaultSize: "A4", defaultOrientation: "landscape" },
  REPORT: { label: "Report", prefix: "RPT", defaultSize: "A4", defaultOrientation: "portrait" },
  TRIAL_BALANCE: { label: "Trial Balance", prefix: "TB", defaultSize: "A4", defaultOrientation: "portrait" },
  PROFIT_LOSS: { label: "Profit & Loss", prefix: "PL", defaultSize: "A4", defaultOrientation: "portrait" },
  BALANCE_SHEET: { label: "Balance Sheet", prefix: "BS", defaultSize: "A4", defaultOrientation: "portrait" },
  GSTR: { label: "GST Return", prefix: "GSTR", defaultSize: "A4", defaultOrientation: "landscape" },
};

// ─── Print Templates ────────────────────────────────────────────────

/**
 * Generate a print-ready HTML document for any ERP document.
 * This creates a self-contained HTML with inline styles for printing.
 */
export function generatePrintHTML(docType, data, options = {}) {
  const config = DOCUMENT_TYPES[docType] || DOCUMENT_TYPES.INVOICE;
  const pageSize = PAGE_SIZES[options.pageSize || config.defaultSize] || PAGE_SIZES.A4;
  const orientation = options.orientation || config.defaultOrientation;
  const margins = { ...DEFAULT_MARGINS, ...options.margins };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.label} ${data.documentNo || ""}</title>
  <style>
    @page {
      size: ${orientation === "landscape" ? `${pageSize.height}mm ${pageSize.width}mm` : `${pageSize.width}mm ${pageSize.height}mm`};
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Inter, -apple-system, sans-serif; font-size: 11px; color: #1e293b; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
    .company-name { font-size: 18px; font-weight: 700; color: #0f172a; }
    .company-details { font-size: 10px; color: #64748b; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 16px; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
    .doc-title p { font-size: 10px; color: #64748b; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .party { flex: 1; }
    .party h4 { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .party p { font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #64748b; text-align: left; }
    td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 11px; }
    .totals { display: flex; justify-content: flex-end; }
    .totals table { width: 250px; }
    .totals td { padding: 4px 8px; }
    .totals .total-row { font-weight: 700; border-top: 2px solid #0f172a; }
    .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: center; }
    .amount-words { font-style: italic; color: #64748b; margin-bottom: 12px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${buildDocumentHTML(docType, data)}
  <div class="footer">${options.footer || `${config.label} generated by Velora ERP`}</div>
</body>
</html>`;
}

function buildDocumentHTML(docType, data) {
  const sections = [];

  // Header
  sections.push(`
    <div class="header">
      <div>
        <div class="company-name">${data.companyName || "Your Company"}</div>
        <div class="company-details">${data.companyAddress || ""}</div>
        <div class="company-details">${data.companyGstin ? `GSTIN: ${data.companyGstin}` : ""}</div>
      </div>
      <div class="doc-title">
        <h2>${DOCUMENT_TYPES[docType]?.label || docType}</h2>
        <p>${data.documentNo || ""}</p>
        <p>Date: ${data.documentDate || new Date().toLocaleDateString("en-IN")}</p>
      </div>
    </div>
  `);

  // Parties
  sections.push(`
    <div class="parties">
      <div class="party">
        <h4>Bill To</h4>
        <p><strong>${data.partyName || "—"}</strong></p>
        <p>${data.partyAddress || ""}</p>
        <p>${data.partyGstin ? `GSTIN: ${data.partyGstin}` : ""}</p>
      </div>
      <div class="party" style="text-align:right">
        <h4>Details</h4>
        <p><strong>${data.paymentTerms ? `Terms: ${data.paymentTerms}` : ""}</strong></p>
        <p>${data.dueDate ? `Due: ${data.dueDate}` : ""}</p>
      </div>
    </div>
  `);

  // Items table
  if (data.items && data.items.length > 0) {
    sections.push(`
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>HSN</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${item.name || ""}</td>
              <td>${item.hsn || ""}</td>
              <td>${item.quantity || ""} ${item.unit || ""}</td>
              <td>₹${Number(item.rate || 0).toLocaleString("en-IN")}</td>
              <td>₹${Number(item.amount || 0).toLocaleString("en-IN")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `);
  }

  // Amount in words
  if (data.amountInWords) {
    sections.push(`<div class="amount-words">Amount in words: ${data.amountInWords}</div>`);
  }

  // Totals
  sections.push(`
    <div class="totals">
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">₹${Number(data.subtotal || 0).toLocaleString("en-IN")}</td></tr>
        ${data.cgst ? `<tr><td>CGST</td><td style="text-align:right">₹${Number(data.cgst).toLocaleString("en-IN")}</td></tr>` : ""}
        ${data.sgst ? `<tr><td>SGST</td><td style="text-align:right">₹${Number(data.sgst).toLocaleString("en-IN")}</td></tr>` : ""}
        ${data.igst ? `<tr><td>IGST</td><td style="text-align:right">₹${Number(data.igst).toLocaleString("en-IN")}</td></tr>` : ""}
        <tr class="total-row"><td>Total</td><td style="text-align:right">₹${Number(data.totalAmount || 0).toLocaleString("en-IN")}</td></tr>
      </table>
    </div>
  `);

  return sections.join("\n");
}

// ─── Print Actions ──────────────────────────────────────────────────

/**
 * Open print preview in a new window.
 */
export function printPreview(docType, data, options = {}) {
  const html = generatePrintHTML(docType, data, options);
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
  return printWindow;
}

/**
 * Direct print — opens print dialog.
 */
export function directPrint(docType, data, options = {}) {
  const html = generatePrintHTML(docType, data, options);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Export to PDF (browser print-to-PDF).
 */
export function exportPDF(docType, data, options = {}) {
  const html = generatePrintHTML(docType, data, options);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      // User can select "Save as PDF" in the print dialog
    };
  }
}

/**
 * Print a raw HTML string (for custom templates).
 */
export function printHTML(html, options = {}) {
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    if (options.autoPrint) {
      printWindow.onload = () => printWindow.print();
    }
  }
  return printWindow;
}

/**
 * Tauri native print (future).
 */
export async function nativePrint(docType, data, options = {}) {
  if (typeof window !== "undefined" && window.__TAURI__) {
    try {
      const { invoke } = window.__TAURI__.core;
      const html = generatePrintHTML(docType, data, options);
      await invoke("print_document", { html });
      return true;
    } catch {
      // Fall back to browser print
    }
  }
  directPrint(docType, data, options);
  return false;
}

export default {
  generatePrintHTML,
  printPreview,
  directPrint,
  exportPDF,
  printHTML,
  nativePrint,
  PAGE_SIZES,
  DOCUMENT_TYPES,
  DEFAULT_MARGINS,
};
