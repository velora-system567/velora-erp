/**
 * @velora/notifications — Centralized Notification Service
 *
 * Supports:
 * - Browser Notification API
 * - Tauri native notifications (future)
 * - Mobile push (future)
 * - In-app notification center
 * - Priority levels (low, medium, high, critical)
 * - Read/unread state
 * - Click-to-open record
 * - Notification history
 * - Dismiss
 * - Grouping by module
 */
import { create } from "zustand";

// ─── Notification Types ─────────────────────────────────────────────

/**
 * @typedef {Object} Notification
 * @property {string} id - Unique ID
 * @property {string} title - Notification title
 * @property {string} body - Notification body text
 * @property {string} module - Module source (sales, purchase, inventory, etc.)
 * @property {string} priority - low | medium | high | critical
 * @property {string} category - Business event category
 * @property {Object} [data] - Record data (type, id, etc.)
 * @property {string} [url] - Deep link URL to open
 * @property {boolean} read - Whether notification has been read
 * @property {boolean} dismissed - Whether notification has been dismissed
 * @property {Date} createdAt - Creation timestamp
 */

// ─── Notification Templates ─────────────────────────────────────────

export const NOTIFICATION_TEMPLATES = {
  PO_APPROVED: {
    title: "Purchase Order Approved",
    body: "PO {documentNo} for ₹{amount} has been approved.",
    module: "purchase",
    priority: "medium",
    category: "approval",
  },
  LOW_STOCK: {
    title: "Low Stock Alert",
    body: "{itemName} is below reorder level ({quantity} remaining).",
    module: "inventory",
    priority: "high",
    category: "alert",
  },
  INVOICE_PAID: {
    title: "Invoice Paid",
    body: "Invoice {documentNo} for ₹{amount} has been marked as paid.",
    module: "sales",
    priority: "medium",
    category: "payment",
  },
  PRODUCTION_COMPLETED: {
    title: "Production Completed",
    body: "Production order {orderNo} has been completed successfully.",
    module: "manufacturing",
    priority: "medium",
    category: "completion",
  },
  MACHINE_FAILURE: {
    title: "Machine Failure",
    body: "Machine {machineName} has reported a breakdown.",
    module: "manufacturing",
    priority: "critical",
    category: "alert",
  },
  MAINTENANCE_DUE: {
    title: "Maintenance Due",
    body: "Scheduled maintenance for {machineName} is due.",
    module: "manufacturing",
    priority: "high",
    category: "reminder",
  },
  QC_FAILED: {
    title: "Quality Inspection Failed",
    body: "QC check {qcNumber} has failed inspection.",
    module: "manufacturing",
    priority: "critical",
    category: "alert",
  },
  LEAD_ASSIGNED: {
    title: "New Lead Assigned",
    body: "Lead {leadName} has been assigned to you.",
    module: "crm",
    priority: "medium",
    category: "assignment",
  },
  GRN_RECEIVED: {
    title: "Goods Received",
    body: "GRN {grnNumber} has been received and inspected.",
    module: "purchase",
    priority: "medium",
    category: "completion",
  },
  USER_LOGIN_NEW_DEVICE: {
    title: "New Device Login",
    body: "A new device ({deviceName}) has logged into your account.",
    module: "security",
    priority: "high",
    category: "security",
  },
};

// ─── Notification Store ─────────────────────────────────────────────

let _notificationId = 0;
function nextId() {
  return `notif_${++_notificationId}_${Date.now()}`;
}

export const useNotificationStore = create((set, get) => ({
  /** @type {Notification[]} */
  notifications: [],

  /** @type {string} Filter by module or 'all' */
  filter: "all",

  /** Maximum notifications to keep in history */
  maxHistory: 200,

  // ── Actions ────────────────────────────────────────────────────────

  /**
   * Add a new notification.
   * Optionally shows browser/desktop notification if permissions granted.
   */
  add(notification) {
    const id = nextId();
    const entry = {
      id,
      title: notification.title || "Notification",
      body: notification.body || "",
      module: notification.module || "system",
      priority: notification.priority || "medium",
      category: notification.category || "info",
      data: notification.data || null,
      url: notification.url || null,
      read: false,
      dismissed: false,
      createdAt: new Date(),
    };

    set((state) => {
      const updated = [entry, ...state.notifications];
      // Trim history
      if (updated.length > state.maxHistory) {
        return { notifications: updated.slice(0, state.maxHistory) };
      }
      return { notifications: updated };
    });

    // Show browser notification if permitted
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(entry.title, {
            body: entry.body,
            icon: "/favicon.ico",
            tag: id,
          });
        } catch {
          // Tauri or non-browser environment — ignore
        }
      }
    }

    return id;
  },

  /**
   * Create notification from template with variable substitution.
   */
  addFromTemplate(templateKey, variables = {}, extra = {}) {
    const template = NOTIFICATION_TEMPLATES[templateKey];
    if (!template) {
      console.warn(`[notifications] Unknown template: ${templateKey}`);
      return null;
    }

    let body = template.body;
    for (const [key, value] of Object.entries(variables)) {
      body = body.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }

    return get().add({
      ...template,
      body,
      ...extra,
    });
  },

  /** Mark notification as read */
  markRead(id) {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  /** Mark all as read */
  markAllRead() {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  /** Dismiss a notification */
  dismiss(id) {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n
      ),
    }));
  },

  /** Remove dismissed from history */
  clearDismissed() {
    set((state) => ({
      notifications: state.notifications.filter((n) => !n.dismissed),
    }));
  },

  /** Clear all */
  clearAll() {
    set({ notifications: [] });
  },

  /** Set filter */
  setFilter(filter) {
    set({ filter });
  },

  // ── Computed ───────────────────────────────────────────────────────

  /** Unread count */
  get unreadCount() {
    return get().notifications.filter((n) => !n.read && !n.dismissed).length;
  },

  /** Filtered notifications */
  getFiltered() {
    const { notifications, filter } = get();
    return notifications.filter((n) => {
      if (n.dismissed) return false;
      if (filter === "all") return true;
      return n.module === filter;
    });
  },

  /** Get by module */
  getByModule(module) {
    return get().notifications.filter((n) => n.module === module && !n.dismissed);
  },
}));

// ─── Browser Permission ─────────────────────────────────────────────

/**
 * Request browser notification permission.
 * Safe to call multiple times — browser will ignore if already granted.
 */
export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

// ─── Tauri Integration (Future) ─────────────────────────────────────

/**
 * Send native notification via Tauri.
 * Only works when running inside Tauri desktop app.
 * Falls back to browser notification in web mode.
 */
export async function sendNativeNotification(title, body, options = {}) {
  // Check if running inside Tauri
  if (typeof window !== "undefined" && window.__TAURI__) {
    try {
      const { invoke } = window.__TAURI__.core;
      await invoke("send_notification", { title, body, ...options });
      return true;
    } catch {
      // Fall through to browser notification
    }
  }

  // Browser fallback
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico", ...options });
    return true;
  }

  return false;
}

export default useNotificationStore;
