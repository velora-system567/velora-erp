import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../store/auth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (payload) => {
      setSession(payload.data);
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

          <div className="mt-3 flex justify-end">
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
