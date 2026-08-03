# Velora ERP — Desktop Architecture

## Overview

Velora ERP is prepared for desktop deployment via **Tauri 2** — a modern framework that builds tiny, fast, secure desktop apps using Rust and web technologies.

### Why Tauri over Electron?

| Feature | Tauri | Electron |
|---------|-------|----------|
| RAM usage | ~30MB | ~150MB+ |
| Installer size | ~5MB | ~150MB+ |
| Security | Rust backend, scoped APIs | Node.js, full system access |
| Performance | Native Rust | Node.js |
| Startup time | <1s | 3-5s |

---

## Project Structure

```
velora-erp/
├── backend/              # Express + Prisma API server
├── frontend/             # React + Vite SPA (web version)
├── desktop/              # Tauri desktop app
│   ├── src-tauri/        # Rust backend (native capabilities)
│   │   ├── src/main.rs   # Tauri commands: print, notifications, files
│   │   ├── tauri.conf.json
│   │   └── Cargo.toml
│   └── package.json
├── packages/             # Shared packages (reusable across web + desktop)
│   ├── notifications/    # Centralized notification service
│   ├── print/            # Print & PDF export service
│   ├── barcode/          # Barcode generation & printing
│   └── cache/            # Offline cache & sync architecture
└── package.json          # Monorepo root (npm workspaces)
```

---

## Shared Packages

### `@velora/notifications` — Notification Service

**Purpose**: Centralized notifications across desktop, browser, and future mobile.

**Features**:
- Browser Notification API
- Tauri native notifications (when running in desktop)
- In-app notification center (Zustand store)
- Priority levels: low, medium, high, critical
- Read/unread state
- Click-to-open record (deep linking)
- Notification history with configurable max
- Pre-built templates for business events:
  - Purchase Order Approved
  - Low Stock Alert
  - Invoice Paid
  - Production Completed
  - Machine Failure
  - Maintenance Due
  - Quality Inspection Failed

**Usage**:
```js
import { useNotificationStore } from "@velora/notifications";

const { add, addFromTemplate, markRead, dismiss } = useNotificationStore();

// Simple notification
add({ title: "New Order", body: "SO-1234 received", module: "sales", priority: "high" });

// Template-based
addFromTemplate("LOW_STOCK", { itemName: "Widget A", quantity: "5" });
```

### `@velora/print` — Print & PDF Export Service

**Purpose**: Centralized printing for all ERP documents.

**Features**:
- Print Preview (opens in new window)
- PDF Export (via browser print-to-PDF)
- Direct Printing
- Page sizes: A4, A5, Letter, Legal
- Orientation: portrait, landscape
- Configurable margins
- Pre-built templates for: Invoices, POs, Sales Orders, Quotations, GRN, Delivery Notes, Receipts, Labels, Reports, Trial Balance, P&L, Balance Sheet, GST Returns

**Usage**:
```js
import { directPrint, printPreview, DOCUMENT_TYPES } from "@velora/print";

// Print preview
printPreview("INVOICE", {
  documentNo: "INV-1234",
  companyName: "Velora Systems",
  partyName: "Acme Corp",
  items: [{ name: "Widget", quantity: 10, rate: 500, amount: 5000 }],
  totalAmount: 5000,
});

// Direct print
directPrint("PURCHASE_ORDER", orderData);
```

### `@velora/barcode` — Barcode Service

**Purpose**: Generate, render, and print barcodes.

**Features**:
- Code128 (all ASCII characters)
- Code39 (alphanumeric)
- EAN-13 (13-digit product codes)
- QR Code (data encoding)
- SVG rendering (zero dependencies)
- Canvas rendering
- Barcode label printing (multiple per page)
- Future: Camera-based scanning via BarcodeDetector API

**Usage**:
```js
import { generateBarcode, printBarcodeLabels, BARCODE_FORMATS } from "@velora/barcode";

// Generate barcode SVG
const svg = generateBarcode("ITM-0001", BARCODE_FORMATS.CODE128, { width: 200, height: 60 });

// Print labels
printBarcodeLabels([
  { name: "Widget A", sku: "ITM-0001", price: "500" },
  { name: "Widget B", sku: "ITM-0002", price: "750" },
]);
```

### `@velora/cache` — Offline Cache & Sync Architecture

**Purpose**: Graceful degradation during network loss.

**Features**:
- IndexedDB-backed local cache (products, customers, vendors, settings, etc.)
- Action queue for offline mutations
- Background sync when network returns
- Conflict detection (last-write-wins with version tracking)
- Retry queue with exponential backoff
- Online/offline status detection
- React hook for offline status

**Usage**:
```js
import { initCache, cacheFirst, cacheList, useOfflineStatus } from "@velora/cache";

// Initialize cache
const cache = await initCache();

// Cache-first strategy
const product = await cacheFirst("products", "ITM-0001", () => fetchProduct("ITM-0001"));

// List caching
const customers = await cacheList("customers", () => fetchCustomers());

// React hook
function MyComponent() {
  const { isOnline } = useOfflineStatus();
  return isOnline ? <span>🟢 Online</span> : <span>🔴 Offline</span>;
}
```

---

## Desktop Native Capabilities (Tauri Commands)

The Rust backend (`desktop/src-tauri/src/main.rs`) exposes these native commands:

| Command | Purpose |
|---------|---------|
| `send_notification` | System notification via OS |
| `print_document` | Native print dialog |
| `save_file_dialog` | File save dialog (exports) |
| `open_file_dialog` | File open dialog (imports) |
| `get_app_info` | App version, platform, arch |

---

## Tauri Window Configuration

- **Default size**: 1440×900
- **Minimum size**: 1024×768
- **Resizable**: Yes
- **System tray**: Enabled
- **Security**: Scoped APIs, no full system access

---

## Building the Desktop App

### Prerequisites
1. Rust toolchain: `rustup`
2. Tauri CLI: `cargo install tauri-cli`
3. System dependencies (see Tauri docs)

### Development
```bash
cd desktop
cargo tauri dev
```

### Production Build
```bash
cd desktop
cargo tauri build
```

Output: `desktop/src-tauri/target/release/bundle/`

---

## Responsive Layout Support

The web UI already supports these breakpoints (verified via Playwright):

| Breakpoint | Width | Status |
|------------|-------|--------|
| Mobile | 390px | ✅ |
| Tablet | 768px | ✅ |
| Laptop | 1024px | ✅ |
| Desktop | 1440px | ✅ |
| 2K | 2560px | ✅ |
| 4K | 3840px | ✅ (scales) |

---

## Auto-Update Architecture

Tauri provides built-in auto-update via `tauri-plugin-updater`. To enable in the future:

1. Add `tauri-plugin-updater` to `Cargo.toml`
2. Configure `updater` in `tauri.conf.json`
3. Set up a release endpoint (GitHub Releases, S3, etc.)

The current architecture does NOT block this — no hardcoded paths or assumptions that would prevent auto-update.

---

## Keyboard Shortcuts

Already implemented via `useShortcutManager` (works in both web and desktop):

| Shortcut | Action |
|----------|--------|
| Ctrl+K | Global Search |
| Ctrl+Shift+S | Toggle Sidebar |
| Ctrl+Shift+D | Go to Dashboard |
| Ctrl+Shift+N | New Record |
| Ctrl+Shift+R | Refresh Module |
| Ctrl+Shift+F | Focus Search |
| Ctrl+/ | Keyboard Shortcuts |
| ESC | Close overlay/drawer |

---

## Future: Mobile Compatibility

The shared packages (`@velora/notifications`, `@velora/print`, `@velora/cache`, `@velora/barcode`) are framework-agnostic and can be reused in:
- React Native mobile apps
- PWA mobile experience
- Capacitor hybrid apps

No mobile-specific code exists today — only the architecture to support it.

---

## File System Operations

For desktop, these are handled via Tauri's native file system:

| Operation | Tauri API |
|-----------|-----------|
| PDF Export | `save_file_dialog` → `fs.writeFile` |
| CSV Export | `save_file_dialog` → `fs.writeFile` |
| Excel Export | `save_file_dialog` → `fs.writeFile` |
| File Import | `open_file_dialog` → `fs.readFile` |
| Local Backup | `save_file_dialog` → `fs.writeFile` |
| Drag & Drop | `onDragDropEvent` (future) |

---

## Performance Optimizations

1. **Bundle splitting**: Vite code-splits by route
2. **Lazy loading**: Page components loaded on demand
3. **Query caching**: React Query with 5-min stale time
4. **Memoization**: React.memo on expensive components
5. **Debounced search**: 200ms debounce on search inputs
6. **Skeleton loading**: Perceived performance improvement
7. **Font optimization**: `font-display: swap`
8. **Image lazy loading**: Native `loading="lazy"`
