import { useMutation } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerTenant } from "../../services/api";
import { useAuthStore } from "../../store/auth";

export function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [form, setForm] = useState({
    tenantName: "",
    companyName: "",
    legalName: "",
    gstin: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    password: "",
  });
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

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(form); }} className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white"><Building2 size={22} /></div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Create Company Workspace</h1>
            <p className="text-sm text-slate-500">Start with your own business data.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["tenantName", "Workspace Name"],
            ["companyName", "Company Name"],
            ["legalName", "Legal Name"],
            ["gstin", "GSTIN"],
            ["ownerName", "Owner Name"],
            ["ownerEmail", "Owner Email"],
            ["ownerPhone", "Owner Phone"],
            ["password", "Password"],
          ].map(([key, label]) => (
            <label key={key} className="block text-sm font-medium text-slate-700">
              {label}
              <input type={key === "password" ? "password" : "text"} value={form[key]} onChange={(event) => update(key, event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500" />
            </label>
          ))}
        </div>
        {mutation.error ? <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{mutation.error.message}</p> : null}
        <button className="mt-6 h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={mutation.isPending}>
          Create Workspace
        </button>
        <p className="mt-4 text-center text-sm text-slate-600">Already set up? <Link className="font-semibold text-blue-700" to="/login">Login</Link></p>
      </form>
    </div>
  );
}
