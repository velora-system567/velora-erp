import { useMutation } from "@tanstack/react-query";
import { Building2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerTenant, requestOtp } from "../../services/api";
import { useAuthStore } from "../../store/auth";

const fieldConfig = [
  ["companyName", "Company Name", "text", "ABC Industries"],
  ["gstin", "GSTIN", "text", "Testing value allowed"],
  ["ownerName", "Owner Name", "text", "Owner or admin name"],
  ["ownerEmail", "Owner Email", "email", "owner@company.com"],
  ["ownerPhone", "Owner Phone", "tel", "Mobile number"],
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
    phoneOtp: "",
    emailOtp: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [sentOtp, setSentOtp] = useState({ phone: false, email: false });
  const otpMutation = useMutation({ mutationFn: requestOtp });
  const mutation = useMutation({
    mutationFn: registerTenant,
    onSuccess: (payload) => {
      setSession(payload.data);
      navigate("/");
    },
  });

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    mutation.mutate({ ...form, gstin: form.gstin.trim(), ownerPhone: form.ownerPhone.trim() });
  }

  function sendOtp(type) {
    const target = type === "phone" ? form.ownerPhone.trim() : form.ownerEmail.trim();
    otpMutation.mutate(
      { channel: type, target },
      { onSuccess: () => setSentOtp((current) => ({ ...current, [type]: true })) },
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white"><Building2 size={22} /></div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Create Company Workspace</h1>
            <p className="text-sm text-slate-500">Start with your own business data.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {fieldConfig.map(([key, label, type, placeholder]) => (
            <label key={key} className="block text-sm font-medium text-slate-700">
              {label}
              <input type={type} placeholder={placeholder} value={form[key]} onChange={(event) => update(key, event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
              {key === "gstin" ? <span className="mt-1 block text-xs leading-5 text-slate-500">Testing phase: fake GSTIN values are allowed. Leave blank if not needed.</span> : null}
            </label>
          ))}
          <label className="block text-sm font-medium text-slate-700">
            Password
            <div className="mt-2 flex h-11 rounded-lg border border-slate-200 focus-within:border-blue-500">
              <input type={showPassword ? "text" : "password"} placeholder="Minimum 8 characters" value={form.password} onChange={(event) => update("password", event.target.value)} className="min-w-0 flex-1 rounded-l-lg px-3 outline-none" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="grid w-11 place-items-center text-slate-500">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Confirm Password
            <input type={showPassword ? "text" : "password"} placeholder="Repeat password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone OTP
            <div className="mt-2 flex gap-2">
              <input inputMode="numeric" placeholder="123456" value={form.phoneOtp} onChange={(event) => update("phoneOtp", event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
              <button type="button" onClick={() => sendOtp("phone")} className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Send</button>
            </div>
            {sentOtp.phone ? <span className="mt-1 block text-xs leading-5 text-slate-500">Phone OTP sent. Enter the code received by SMS.</span> : null}
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email OTP
            <div className="mt-2 flex gap-2">
              <input inputMode="numeric" placeholder="123456" value={form.emailOtp} onChange={(event) => update("emailOtp", event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
              <button type="button" onClick={() => sendOtp("email")} className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Send</button>
            </div>
            {sentOtp.email ? <span className="mt-1 block text-xs leading-5 text-slate-500">Email OTP sent. Enter the code received by email.</span> : null}
          </label>
        </div>
        {otpMutation.error ? <p className="mt-4 whitespace-pre-line rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{otpMutation.error.message}</p> : null}
        {mutation.error ? <p className="mt-4 whitespace-pre-line rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{mutation.error.message}</p> : null}
        <button className="mt-6 h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={mutation.isPending}>
          Create Workspace
        </button>
        <p className="mt-4 text-center text-sm text-slate-600">Already set up? <Link className="font-semibold text-blue-700" to="/login">Login</Link></p>
      </form>
    </div>
  );
}
