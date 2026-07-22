import { useMutation } from "@tanstack/react-query";
import { Building2, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One digit", test: (v) => /\d/.test(v) },
  { label: "One special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const otp = location.state?.otp || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => setSuccess(true),
  });

  // Redirect if no email/otp
  useEffect(() => {
    if (!email || !otp) navigate("/forgot-password", { replace: true });
  }, [email, otp, navigate]);

  const errors = [];
  if (password !== confirmPassword && confirmPassword) errors.push("Passwords do not match");
  if (password && !PASSWORD_RULES.every((r) => r.test(password))) {
    errors.push("Password does not meet requirements");
  }

  const isValid = password && confirmPassword && password === confirmPassword
    && PASSWORD_RULES.every((r) => r.test(password));

  if (success) {
    return (
      <div className="grid min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="mx-auto flex w-full max-w-md flex-col justify-center text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
            <ShieldCheck size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Password reset successful</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your password has been changed. All active sessions have been terminated for security.
          </p>
          <Link
            to="/login"
            className="mx-auto mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign in with new password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Set new password</h1>
          <p className="mt-1 text-sm text-slate-500">
            For <strong>{email}</strong>
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({ email, otp, password });
          }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-700">New password</label>
          <div className="mt-1.5 flex h-11 items-center rounded-lg border border-slate-200 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-full min-w-0 flex-1 rounded-l-lg px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="grid h-full w-11 place-items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Password strength indicator */}
          <div className="mt-3 grid grid-cols-4 gap-1">
            {PASSWORD_RULES.map((rule, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition ${
                  password ? (rule.test(password) ? "bg-emerald-500" : "bg-slate-200") : "bg-slate-100"
                }`}
              />
            ))}
          </div>
          <ul className="mt-2 space-y-1">
            {PASSWORD_RULES.map((rule, i) => (
              <li key={i} className={`flex items-center gap-2 text-xs transition ${
                rule.test(password) ? "text-emerald-700" : "text-slate-500"
              }`}>
                <span className={`grid h-4 w-4 place-items-center rounded-full ${
                  rule.test(password) ? "bg-emerald-100" : "bg-slate-100"
                }`}>
                  {rule.test(password) ? "✓" : "•"}
                </span>
                {rule.label}
              </li>
            ))}
          </ul>

          <label className="mt-4 block text-sm font-medium text-slate-700">Confirm password</label>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
              confirmPassword && password !== confirmPassword ? "border-rose-300" : "border-slate-200"
            }`}
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-xs text-rose-600">Passwords do not match</p>
          )}

          {mutation.error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{mutation.error.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || mutation.isPending}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Resetting password…</>
            ) : (
              "Reset password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
