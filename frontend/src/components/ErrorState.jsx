import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

/**
 * Sanitize error messages before displaying to users.
 * Hides internal UUID references and raw Zod errors.
 */
function sanitizeErrorMessage(message) {
  if (!message) return "An unexpected error occurred.";
  // Hide raw UUID values from display
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  let clean = message.replace(uuidPattern, "the selected record");
  // Hide raw Zod path references
  clean = clean.replace(/params\.\w+:?\s*/gi, "");
  clean = clean.replace(/query\.\w+:?\s*/gi, "");
  clean = clean.replace(/body\.\w+:?\s*/gi, "");
  return clean || "An unexpected error occurred.";
}

/**
 * Renders a standardized error state with an optional retry button.
 */
export function ErrorState({ error, onRetry, title = "Something went wrong" }) {
  const isNetworkError =
    error?.message?.toLowerCase().includes("failed to fetch") ||
    error?.message?.toLowerCase().includes("network");

  const isInvalidRef =
    error?.message?.toLowerCase().includes("invalid") &&
    (error?.message?.toLowerCase().includes("reference") ||
     error?.message?.toLowerCase().includes("uuid"));

  const Icon = isNetworkError ? WifiOff : AlertTriangle;
  const message = isInvalidRef
    ? "No record selected. Please choose a valid record to continue."
    : sanitizeErrorMessage(error?.message);

  const displayTitle = isInvalidRef ? "No Record Selected" : title;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-rose-100 bg-rose-50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
        <Icon size={22} className="text-rose-600" />
      </div>
      <p className="mt-3 text-base font-semibold text-slate-950">{displayTitle}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 transition"
        >
          <RefreshCw size={15} />
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Inline error banner — use inside forms.
 */
export function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{sanitizeErrorMessage(error?.message)}</span>
    </div>
  );
}

/**
 * Permission denied state.
 */
export function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-amber-100 bg-amber-50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
        <AlertTriangle size={22} className="text-amber-600" />
      </div>
      <p className="mt-3 text-base font-semibold text-slate-950">Access Restricted</p>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-600">
        You don't have permission to view this section. Contact your administrator.
      </p>
    </div>
  );
}
