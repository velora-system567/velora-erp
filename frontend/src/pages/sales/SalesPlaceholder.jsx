/**
 * Sales Module Placeholder
 *
 * The legacy Sales module has been removed for a clean rebuild.
 * This placeholder prevents broken routes and shows a friendly message.
 * See docs/sales-module-spec.md for the full capture/specification.
 */
import { ShoppingCart, AlertCircle, Clock } from "lucide-react";
import { Link } from "react-router-dom";

export default function SalesPlaceholder() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-950">
          <ShoppingCart size={28} className="text-blue-600" />
          Sales
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sales module is being rebuilt for a better experience.
        </p>
      </div>

      {/* Status card */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle size={24} className="mt-0.5 flex-shrink-0 text-blue-600" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-blue-800">
              Module Under Reconstruction
            </h2>
            <p className="mt-1 text-sm text-blue-700">
              The previous Sales implementation was removed to make way for a
              clean, stable rebuild. All specifications have been captured in{" "}
              <code className="rounded bg-white/50 px-1.5 font-mono text-xs">
                docs/sales-module-spec.md
              </code>
              .
            </p>
            <p className="mt-2 text-sm text-blue-600">
              <Clock size={14} className="mr-1 inline" /> Expected: new Sales
              module landing in a future sprint.
            </p>
          </div>
        </div>
      </div>

      {/* What's preserved */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-950">
          <ShoppingCart size={18} className="text-blue-600" /> What's Still
          Working
        </h2>
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            ✅ <strong>All other ERP modules</strong> — Dashboard, Inventory,
            Purchase, Manufacturing, Accounts, CRM, HR, Assets, Reports, Audit,
            Admin, Settings.
          </p>
          <p>
            ✅ <strong>Shared infrastructure</strong> — BusinessDocument, Lead,
            Payment, Customer, Item models; all permissions; inventory stock
            engine; accounting journals.
          </p>
          <p>
            ✅ <strong>CRM</strong> — independent at{" "}
            <Link to="/crm" className="font-medium text-blue-600 hover:underline">
              /crm
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-950">
          Quick Links
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { to: "/", label: "Dashboard" },
            { to: "/crm", label: "CRM" },
            { to: "/inventory", label: "Inventory" },
            { to: "/purchase", label: "Procurement" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
