import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi, apiRequest } from "../../services/api";
import { useAuthStore } from "../../store/auth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  // Check if Google OAuth is configured
  const googleQuery = useQuery({
    queryKey: ["google-auth-url", keepSignedIn],
    queryFn: () => apiRequest(`/auth/google/url?rememberMe=${keepSignedIn ? "true" : "false"}`),
    staleTime: 5 * 60 * 1000,
  });
  const googleConfigured = googleQuery.data?.data?.configured;
  const googleUrl = googleQuery.data?.data?.url;

  function handleGoogleLogin() {
    if (googleUrl) {
      window.location.href = googleUrl;
    }
  }

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values) => authApi.login({ ...values, rememberMe: keepSignedIn }),
    onSuccess: (payload) => {
      const data = payload.data;
      if (data?.requiresTwoFactor) {
        // First factor passed — move to the 2FA step.
        navigate("/verify-2fa", { state: { challengeToken: data.challengeToken, rememberMe: keepSignedIn } });
        return;
      }
      setSession(data);
      navigate("/");
    },
  });

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your Velora ERP workspace</p>
        </div>

        {/* Google login */}
        {googleConfigured && (
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={googleQuery.isLoading}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gradient-to-br from-slate-50 to-blue-50 px-2 text-xs text-slate-400">OR</span>
              </div>
            </div>
          </>
        )}

        {/* Login form */}
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-700">Email address</label>
          <input
            type="email"
            autoComplete="email"
            placeholder="rajesh@mahindra.com"
            className={`mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
              form.formState.errors.email ? "border-rose-300" : "border-slate-200"
            }`}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-rose-600">{form.formState.errors.email.message}</p>
          )}

          <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
          <div className={`mt-1.5 flex h-11 items-center rounded-lg border transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 ${
            form.formState.errors.password ? "border-rose-300" : "border-slate-200"
          }`}>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-full min-w-0 flex-1 rounded-l-lg px-3 text-sm outline-none"
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="grid h-full w-11 place-items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="mt-1 text-xs text-rose-600">{form.formState.errors.password.message}</p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Keep me signed in for 15 days
            </label>
            <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              Forgot password?
            </Link>
          </div>

          {mutation.error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{mutation.error.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Signing in…</>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {googleQuery.data?.data?.configured === false && googleQuery.isFetched && (
          <p className="mt-3 text-center text-xs text-amber-600">
            Google sign-in is not configured for this environment.
          </p>
        )}

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-slate-600">
          First time?{" "}
          <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-800">
            Create your workspace
          </Link>
        </p>
      </div>
    </div>
  );
}
