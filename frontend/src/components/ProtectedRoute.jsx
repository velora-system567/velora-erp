import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore, ensureAuthenticated, getIsAuthenticated } from "../store/auth";

/**
 * ROOT CAUSE FIX for "login again every day":
 * The old implementation only validated the ACCESS token's expiry and, if it
 * had expired (access tokens live 8h), it DELETED the whole session and bounced
 * to /login — even though the refresh token (7d, or 15d persistent) was still
 * valid. That made anyone who returned "another day" get logged out.
 *
 * Now we wait for the auth state to hydrate and try a silent refresh using the
 * refresh token before ever redirecting to /login. We only redirect after a
 * refresh failure.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const authState = useAuthStore((s) => s.authState);
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Fast path: if the access token is provably valid OR a refresh token
    // exists, optimistically render while we (re)validate.
    (async () => {
      const result = await ensureAuthenticated();
      if (cancelled) return;
      setOk(result);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [location.pathname]);

  // While auth is hydrating, show a neutral splash, never /login.
  if (loading || authState === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (ok === false || !getIsAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
