/**
 * RouteErrorBoundary — Catches rendering exceptions in route modules.
 *
 * Without this, ANY unhandled exception in a page component causes
 * the entire page to go white (blank). This boundary catches the
 * error and shows a recovery UI instead.
 *
 * Applied to every route in App.jsx via the layout wrapper.
 */
import { Component } from "react";
import { AlertTriangle, RefreshCw, Home, WifiOff } from "lucide-react";

export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("[RouteErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) this.props.onRetry();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const message = error?.message || "An unexpected error occurred";
      const isChunkError = message.includes("Loading chunk") || message.includes("dynamically imported module");
      const isImportError = message.includes("Failed to fetch") || message.includes("import");
      const isServiceUnavailable = error?.isServiceUnavailable || message.includes("Service temporarily unavailable");

      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-lg text-center">
            {/* Service Unavailable — Database down / backend unreachable */}
            {isServiceUnavailable ? (
              <>
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
                  <WifiOff size={28} className="text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Service Temporarily Unavailable
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The backend service is temporarily unavailable. This usually resolves
                  automatically within a few seconds. Your data is safe.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {message}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
                  <AlertTriangle size={28} className="text-rose-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {isChunkError ? "Failed to load module" : "Something went wrong"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isChunkError
                    ? "A required module failed to load. This may be a network issue. Try refreshing the page."
                    : isImportError
                    ? "Failed to load a required resource. Check your network connection."
                    : "This page encountered an unexpected error. You can try again or return to the dashboard."}
                </p>
              </>
            )}

            {/* Error details for development */}
            {process.env.NODE_ENV === "development" && error && (
              <details className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-rose-700">
                  Error details
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto text-xs text-rose-800">
                  {message}
                  {this.state.errorInfo?.componentStack && (
                    <>{`Component Stack:${this.state.errorInfo.componentStack}`}</>
                  )}
                </pre>
              </details>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md"
              >
                <RefreshCw size={15} /> {isServiceUnavailable ? "Retry" : "Try Again"}
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-all duration-150 hover:bg-slate-50"
              >
                <Home size={15} /> Dashboard
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Reference: {new Date().toISOString().slice(0, 19)} • Velora ERP
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
