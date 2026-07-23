import { useMutation } from "@tanstack/react-query";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../store/auth";

const fieldConfig = [
  ["companyName", "Company Name", "text", "Mahindra Auto Parts Pvt Ltd"],
  ["gstin", "GSTIN", "text", "27AABCM1234A1Z5"],
  ["ownerName", "Owner Name", "text", "Rajesh Patil"],
  ["ownerEmail", "Owner Email", "email", "rajesh@mahindra.com"],
  ["ownerPhone", "Owner Phone", "tel", "9823456710"],
];

export function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [form, setForm] = useState({
    companyName: "",
    gstin: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    password: "",
    confirmPassword: "",
    emailOtp: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [validationError, setValidationError] = useState("");

  const otpMutation = useMutation({ mutationFn: authApi.requestOtp });
  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (payload) => {
      setSession(payload.data);
      navigate("/");
    },
  });

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "ownerEmail") {
      setValidationError("");
      setSuccessMessage("");
    }
  }

  function submit(event) {
    event.preventDefault();
    mutation.mutate({
      ...form,
      gstin: form.gstin.trim(),
      ownerPhone: form.ownerPhone.trim() || undefined,
    });
  }

  function sendOtp() {
    const target = form.ownerEmail.trim();
    setValidationError("");
    setSuccessMessage("");

    if (!target) {
      setValidationError("Email is required to send OTP.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(target)) {
      setValidationError("Please enter a valid email address.");
      return;
    }

    setSendingOtp(true);
    otpMutation.mutate(
      { channel: "email", target },
      {
        onSuccess: (data) => {
          const delivered = data?.data?.delivered;
          if (delivered) {
            setSuccessMessage("Verification code sent to your email.");
          } else {
            setSuccessMessage("OTP generated but email delivery requires RESEND_API_KEY. Check server console for the code.");
          }
          setSendingOtp(false);
        },
        onError: () => {
          setSendingOtp(false);
        },
      },
    );
  }

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="mx-auto flex w-full max-w-2xl flex-col justify-center">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Create Company Workspace</h1>
          <p className="mt-1 text-sm text-slate-500">Start with your own business data.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            {fieldConfig.map(([key, label, type, placeholder]) => (
              <label key={key} className="block text-sm font-medium text-slate-700">
                {label}
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            ))}

            {/* Password */}
            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="mt-1.5 flex h-11 rounded-lg border border-slate-200 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Rajesh@123"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="min-w-0 flex-1 rounded-l-lg px-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="grid w-11 place-items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {/* Confirm Password */}
            <label className="block text-sm font-medium text-slate-700">
              Confirm Password
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Rajesh@123"
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            {/* Email OTP */}
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Email Verification Code
              <div className="mt-1.5 flex gap-2">
                <input
                  inputMode="numeric"
                  placeholder="123456"
                  value={form.emailOtp}
                  onChange={(e) => update("emailOtp", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={sendingOtp}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingOtp ? <Loader2 size={15} className="animate-spin" /> : null}
                  {sendingOtp ? "Sending…" : "Send code"}
                </button>
              </div>
            </label>
          </div>

          {/* Messages */}
          {validationError && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{validationError}</p>
          )}
          {otpMutation.error && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {otpMutation.error.message || "Failed to send OTP. Please try again."}
            </p>
          )}
          {successMessage && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</p>
          )}
          {mutation.error && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{mutation.error.message}</p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Creating workspace…</>
            ) : (
              "Create Workspace"
            )}
          </button>

          <p className="mt-4 text-center text-sm text-slate-600">
            Already set up?{" "}
            <Link className="font-semibold text-blue-600 hover:text-blue-800" to="/login">
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
