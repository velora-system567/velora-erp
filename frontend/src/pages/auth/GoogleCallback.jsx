import { useMutation } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../store/auth";

/**
 * Handles the Google OAuth redirect callback.
 * Exchange path: /auth/google/callback?code=...&state=...
 * - Exchanges the authorization code for a session.
 * - If the account has 2FA enabled, forwards to the 2FA step.
 * - Otherwise completes the session and redirects to the dashboard.
 */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("exchanging");
  const started = useRef(false);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errParam = searchParams.get("error");
  const errDesc = searchParams.get("error_description");

  const mutation = useMutation({
    mutationFn: () => authApi.googleLogin(code, state),
    onSuccess: (payload) => {
      const data = payload.data;
      if (data?.requiresTwoFactor) {
        let rememberMe = false;
        try {
          rememberMe = Boolean(JSON.parse(state || "{}").rememberMe);
        } catch { /* ignore */ }
        navigate("/verify-2fa", { state: { challengeToken: data.challengeToken, rememberMe }, replace: true });
        return;
      }
      setSession(data);
      navigate("/", { replace: true });
    },
    onError: (err) => {
      setStatus("error");
      setError(err.message || "Google sign-in failed. Please try again.");
    },
  });

  useEffect(() => {
    if (started.current) return;

    // Google rejected the auth request or the user cancelled.
    if (errParam) {
      setStatus("error");
      if (errParam === "access_denied") {
        setError("Google sign-in was cancelled.");
      } else {
        setError(errDesc || "Google sign-in failed. Please try again.");
      }
      started.current = true;
      return;
    }

    if (!code) {
      setStatus("error");
      setError("Google sign-in was cancelled or the callback was malformed.");
      started.current = true;
      return;
    }

    started.current = true;
    if (!mutation.isPending && !mutation.isSuccess) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, errParam]);

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">
            {status === "error" ? "Sign-in issue" : "Completing sign-in"}
          </h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          {status === "exchanging" && mutation.isPending ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-600">Verifying your Google account…</p>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{error}</p>
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Redirecting…</p>
          )}
        </div>
      </div>
    </div>
  );
}
