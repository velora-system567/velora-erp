import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, Copy, KeyRound, Loader2, Laptop, LogOut, Mail, RefreshCw, Shield, ShieldCheck, ShieldOff, Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../store/auth";
import { PageHeader } from "../../components/PageHeader";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function recoveryCodeBox(codes) {
  if (!codes || codes.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
        <KeyRound size={15} /> Save your recovery codes
      </p>
      <p className="mt-1 text-xs text-amber-700">
        These codes are shown once. Store them somewhere safe — they can be used to sign in if you lose your authenticator.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {codes.map((c) => (
          <code key={c} className="rounded-lg bg-white px-2 py-1.5 text-center text-sm font-mono font-semibold tracking-wide text-slate-800">{c}</code>
        ))}
      </div>
    </div>
  );
}

function TwoFactorCard({ profile }) {
  const qc = useQueryClient();
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [newRecovery, setNewRecovery] = useState(null);
  const [openStep, setOpenStep] = useState("code"); // code | success

  const setupMutation = useMutation({
    mutationFn: () => authApi.setup2FA(),
    onSuccess: (payload) => {
      setSetupData(payload.data);
      setShowSetup(true);
      setOpenStep("code");
      setTotpCode("");
      setNewRecovery(null);
    },
  });

  const enableMutation = useMutation({
    mutationFn: () => authApi.enable2FA(totpCode),
    onSuccess: (payload) => {
      setNewRecovery(payload.data?.recoveryCodes || []);
      setOpenStep("success");
      qc.invalidateQueries({ queryKey: ["security-profile"] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => authApi.disable2FA(),
    onSuccess: () => {
      setShowSetup(false);
      setSetupData(null);
      qc.invalidateQueries({ queryKey: ["security-profile"] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => authApi.regenerateRecoveryCodes(),
    onSuccess: (payload) => {
      setNewRecovery(payload.data?.recoveryCodes || []);
    },
  });

  if (showSetup && setupData) {
    const otpauth = setupData.otpauth || "";
    const otpauthUrl = otpauth.startsWith("otpauth://") ? otpauth : null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">Set up authenticator app</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.).
            </p>
          </div>
          <button onClick={() => { setShowSetup(false); setSetupData(null); }} className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={18} />
          </button>
        </div>

        {otpauthUrl && (
          <div className="mt-4 flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`}
              alt="2FA QR code"
              className="rounded-xl border border-slate-200"
            />
          </div>
        )}
        {setupData.secret && (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-500">Manual entry secret</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-mono font-semibold tracking-wider text-slate-800">{setupData.secret}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(setupData.secret)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                title="Copy secret"
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">Enter the 6-digit code to verify</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {enableMutation.error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm text-rose-700">{enableMutation.error.message}</p>
          </div>
        )}
        <button
          onClick={() => enableMutation.mutate()}
          disabled={totpCode.length !== 6 || enableMutation.isPending}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {enableMutation.isPending ? (<><Loader2 size={16} className="animate-spin" /> Verifying…</>) : "Enable 2FA"}
        </button>

        {openStep === "success" && recoveryCodeBox(newRecovery)}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${profile.twoFactorEnabled ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
          {profile.twoFactorEnabled ? <ShieldCheck size={20} /> : <Shield size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">Two-step verification</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {profile.twoFactorEnabled
                  ? "Enabled — you'll need a code from your authenticator to sign in."
                  : "Add an extra layer of security with a TOTP authenticator app."}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${profile.twoFactorEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {profile.twoFactorEnabled ? <CheckCircle2 size={13} /> : null}
              {profile.twoFactorEnabled ? "Enabled" : "Off"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!profile.twoFactorEnabled ? (
              <button
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {setupMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                Enable 2FA
              </button>
            ) : (
              <>
                <button
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {regenerateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Regenerate recovery codes
                </button>
                <button
                  onClick={() => disableMutation.mutate()}
                  disabled={disableMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  {disableMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldOff size={15} />}
                  Disable 2FA
                </button>
              </>
            )}
          </div>

          {regenerateMutation.error && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{regenerateMutation.error.message}</p>
            </div>
          )}

          {recoveryCodeBox(newRecovery)}
        </div>
      </div>
    </div>
  );
}

function SecuritySettingsPage() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const sessionExpiresAt = useAuthStore((s) => s.sessionExpiresAt);
  const sessionType = useAuthStore((s) => s.sessionType);

  const isAuthenticated = useAuthStore((s) => !!s.user);
  const profileQuery = useQuery({
    queryKey: ["security-profile"],
    queryFn: () => authApi.securityProfile(),
    enabled: isAuthenticated,
  });
  const sessionsQuery = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: () => authApi.sessions(),
    enabled: isAuthenticated,
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => {
      clearSession();
      window.location.href = "/login";
    },
  });

  const logoutDevice = useMutation({
    mutationFn: (id) => authApi.logoutDevice(id),
    onSuccess: () => sessionsQuery.refetch(),
  });

  const profile = profileQuery.data?.data || {};

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6 md:py-6 xl:p-8">
      <PageHeader
        title="Security & Sign-in"
        description="Manage two-factor authentication, authentication methods, and active sessions."
      />

      {/* Authentication methods */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[15px] font-semibold text-slate-900">Authentication methods</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600">
              <Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Email &amp; password</p>
              <p className="text-xs text-slate-500">{profile.email || "Connected"}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={12} /> Connected
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-100 text-red-500">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Google</p>
              <p className="text-xs text-slate-500">
                {profile.googleConnected ? profile.email : "Not connected"}
              </p>
            </div>
            {profile.googleConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={12} /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                Not connected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2FA */}
      <TwoFactorCard profile={profile} />

      {/* Session */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[15px] font-semibold text-slate-900">Session</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
              <Smartphone size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Current session</p>
              <p className="text-xs text-slate-500">
                {sessionType === "persistent" ? "Persistent login (15 days)" : "Standard session"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
              <Laptop size={12} /> Active
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Persistent login expiration</p>
              <p className="text-xs text-slate-500">
                {sessionType === "persistent"
                  ? `Trusted until ${formatDate(sessionExpiresAt)}`
                  : "Not enabled for this session"}
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const refreshToken = localStorage.getItem("velora_refresh_token");
                if (refreshToken) await authApi.logout(refreshToken);
              } catch { /* best effort */ }
              clearSession();
              navigate("/login");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut size={15} /> Logout from this device
          </button>

          <button
            onClick={() => { if (window.confirm("Log out of this session on all devices? You'll need to sign in again everywhere.")) logoutAllMutation.mutate(); }}
            disabled={logoutAllMutation.isPending}
            className="ml-2 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            {logoutAllMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
            Logout from all devices
          </button>
        </div>
      </div>

      {/* Active sessions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[15px] font-semibold text-slate-900">Active sessions</p>
        {sessionsQuery.isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={15} className="animate-spin" /> Loading sessions…
          </div>
        ) : sessionsQuery.data?.data?.length ? (
          <div className="mt-3 space-y-2">
            {sessionsQuery.data.data.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {s.deviceInfo || "Unknown device"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.sessionType === "persistent" ? "Persistent · " : ""}Expires {formatDate(s.expiresAt)}
                    {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => logoutDevice.mutate(s.id)}
                  disabled={logoutDevice.isPending}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                >
                  Sign out
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No active sessions.</p>
        )}
      </div>

      <p className="text-xs text-slate-400">
        <Link to="/settings" className="font-semibold text-blue-600 hover:text-blue-800">← Back to Settings</Link>
      </p>
    </div>
  );
}

export default SecuritySettingsPage;
