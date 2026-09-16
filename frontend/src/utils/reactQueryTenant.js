import { useAuthStore } from "../store/auth";

export function useTenantContext() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const companyId = useAuthStore((s) => s.user?.companyId);
  return { tenantId, companyId };
}

export function tenantKey(parts) {
  const st = useAuthStore.getState();
  const user = st?.user;
  const tenantId = user?.tenantId;
  const companyId = user?.companyId;
  if (!tenantId || !companyId) return parts;
  return ["tenant", tenantId, "company", companyId, ...parts];
}
