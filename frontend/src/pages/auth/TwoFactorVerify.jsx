import { useMutation } from "@tanstack/react-query";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../store/auth";

function getInputState(location) {
  const s = location.state || {};
  let challengeToken = s.challengeToken || null;
  let rememberMe = Boolean(s.rememberMe);
  // Fallback: challenge may be in sessionStorage if the page was refreshed.
  if (!challengeToken) {
    try {
      const stored = JSON.parse(sessionStorage.getItem("velora_2fa_challenge") || "null");
      if (stored?.challengeToken) {
        challengeToken = stored.challengeToken;
        rememberMe = Boolean(stored.rememberMe);
      }
    } catch { /* ignore */ }
  }
  return { challengeToken, rememberMe };
}

export default function TwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const { challengeToken, rememberMe } = getInputState(location);
  const [code, setCode] = useState("");

  // Persist so a page refresh (which loses router state) still works.
  useEffect(() => {
    if (challengeToken) {
      try {
        sessionStorage.setItem("velora_2fa_challenge", JSON.stringify({ challengeToken, rememberMe }));
      } catch { /* ignore */ }
    }
  }, [challengeToken, rememberMe]);

  const mutation = useMutation({
    mutationFn: () => authApi.verify2FA(challengeToken, code, rememberMe),
    onSuccess: (payload) => {
      try { sessionStorage.removeItem("velora_2fa_challenge"); } catch { /* ignore */ }
      setSession(payload.data);
      navigate("/", { replace: true });
    },
  });

  if (!challengeToken) {
    return (
      <div className="grid min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="mx-auto w-full max-w-md text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 mx-auto">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-950">Verification session missing</h1>
          <p className="mt-2 text-sm text-slate-600">Please sign in again to continue.</p>
          <Link to="/login" className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Two-step verification</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the 6-digit code from your authenticator app, or a recovery code.
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-700">Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, "").toUpperCase().slice(0, 10))}
            placeholder="000000"
            className="mt-1.5 h-12 w-full rounded-lg border border-slate-200 px-3 text-center text-xl font-bold tracking-[0.4em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          {mutation.error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{mutation.error.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={code.length < 6 || mutation.isPending}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Verifying…</>
            ) : (
              "Verify & continue"
            )}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-800">
              Use a different account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
