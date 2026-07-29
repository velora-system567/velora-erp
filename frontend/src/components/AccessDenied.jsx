/**
 * AccessDenied — Professional 403 page.
 * Shown when a user tries to access a module they don't have permission for.
 */
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AccessDenied({ moduleName = "this section" }) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200">
          <ShieldAlert size={48} className="text-amber-500" />
        </div>
        <div className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 ring-1 ring-rose-200">
          <Lock size={18} className="text-rose-600" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        You don't have permission to access <strong className="font-semibold text-slate-800">{moduleName}</strong>.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        If you need access, contact your administrator.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}
