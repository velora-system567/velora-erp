import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { z } from "zod";
import { hasApiBaseUrl, login } from "../../services/api";
import { useAuthStore } from "../../store/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (payload) => {
      setSession(payload.data);
      navigate("/");
    },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Login to Velora ERP</h1>
            <p className="text-sm text-slate-500">Use your company account.</p>
          </div>
        </div>
        <label className="mt-6 block text-sm font-medium text-slate-700">Email</label>
        <input placeholder="rajesh@mahindra.com" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" {...form.register("email")} />
        <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
        <input type="password" placeholder="Rajesh@123" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" {...form.register("password")} />
        {mutation.error ? <p className="mt-3 text-sm text-rose-600">{mutation.error.message}</p> : null}
        {!hasApiBaseUrl ? (
          <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
            Backend API is not connected on this deployment yet. Configure <span className="font-mono font-semibold">VITE_API_BASE_URL</span> after deploying the Express API.
          </p>
        ) : null}
        <button disabled={!hasApiBaseUrl} className="mt-6 h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          Login
        </button>
        <p className="mt-4 text-center text-sm text-slate-600">First company setup? <Link className="font-semibold text-blue-700" to="/register">Create workspace</Link></p>
      </form>
    </div>
  );
}
