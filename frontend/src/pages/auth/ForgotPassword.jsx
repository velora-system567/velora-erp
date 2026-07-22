import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Building2, Loader2, Mail, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../services/api";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email | otp | done
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);

  const form = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });

  const sendOtpMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => {
      setStep("otp");
      setCountdown(60);
    },
  });

  const resetMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => setStep("done"),
  });

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleEmailSubmit = form.handleSubmit((values) => {
    setEmail(values.email);
    sendOtpMutation.mutate(values.email);
  });

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    navigate("/reset-password", { state: { email, otp } });
  };

  if (step === "done") {
    return (
      <div className="grid min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="mx-auto flex w-full max-w-md flex-col justify-center text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100">
            <Mail size={28} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Check your email</h1>
          <p className="mt-2 text-sm text-slate-600">
            We've sent a password reset code to <strong>{email}</strong>. Use the code on the next screen to reset your password.
          </p>
          <button
            onClick={() => navigate("/reset-password", { state: { email } })}
            className="mx-auto mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Enter reset code
          </button>
          <p className="mt-6 text-sm text-slate-500">
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-800">Back to login</Link>
          </p>
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
          <h1 className="text-2xl font-bold text-slate-950">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === "email"
              ? "Enter your email and we'll send you a reset code"
              : "Enter the 6-digit code sent to your email"}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">Email address</label>
            <input
              type="email"
              placeholder="rajesh@mahindra.com"
              className={`mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                form.formState.errors.email ? "border-rose-300" : "border-slate-200"
              }`}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-rose-600">{form.formState.errors.email.message}</p>
            )}
            {sendOtpMutation.error && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm text-rose-700">{sendOtpMutation.error.message}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={sendOtpMutation.isPending}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sendOtpMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Sending…</>
              ) : (
                <>
                  <Mail size={16} /> Send reset code
                </>
              )}
            </button>
            <p className="mt-4 text-center text-sm text-slate-500">
              <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">6-digit verification code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1.5 h-12 w-full rounded-lg border border-slate-200 px-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {resetMutation.error && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm text-rose-700">{resetMutation.error.message}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={otp.length !== 6 || resetMutation.isPending}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {resetMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Verifying…</>
              ) : (
                "Verify code"
              )}
            </button>

            {countdown > 0 ? (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-500">
                <Timer size={14} /> Resend in {countdown}s
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  sendOtpMutation.mutate(email);
                  setCountdown(60);
                }}
                className="mt-4 w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Resend code
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
