/**
 * useSalesData — Data fetching for all Sales tabs.
 * Manages React Query hooks for leads, quotations, orders, invoices, and receipts.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi, leadsApi, coreApi } from "../../../services/api";

// ─── Master data ─────────────────────────────────────────────────────────────

export function useSalesMasters() {
  return useQuery({
    queryKey: ["sales-masters"],
    queryFn: async () => {
      // allSettled keeps the bundle resilient: a 403/500 on one optional
      // sub-resource (e.g. `users` for roles without users:view) must never
      // wipe out the core data (customers/items/branches) the rest of the
      // Sales tabs depend on.
      const [cRes, iRes, uRes, bRes] = await Promise.allSettled([
        coreApi.list("customers", { limit: 500 }),
        coreApi.list("items", { limit: 500 }),
        coreApi.list("users", { limit: 200 }),
        coreApi.list("branches", { limit: 200 }),
      ]);
      const value = (r) => (r.status === "fulfilled" ? r.value : { data: [] });
      return {
        customers: value(cRes).data || [],
        items: value(iRes).data || [],
        users: value(uRes).data || [],
        branches: value(bRes).data || [],
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function useSalesDashboard(enabled = true) {
  return useQuery({
    queryKey: ["sales-dashboard"],
    queryFn: () => salesApi.dashboard(),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    enabled,
  });
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export function useLeads(params = {}) {
  return useQuery({
    queryKey: ["leads", params],
    queryFn: () => leadsApi.list(params),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => leadsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => leadsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => leadsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

// ─── Quotations ──────────────────────────────────────────────────────────────

export function useQuotations(params = {}) {
  return useQuery({
    queryKey: ["quotations", params],
    queryFn: () => salesApi.quotations(params),
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => salesApi.createQuotation(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); },
  });
}

export function useConvertQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => salesApi.convertQuotation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });
}

// ─── Sales Orders ────────────────────────────────────────────────────────────

export function useSalesOrders(params = {}) {
  return useQuery({
    queryKey: ["sales-orders", params],
    queryFn: () => salesApi.salesOrders(params),
  });
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export function useInvoices(params = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => salesApi.invoices(params),
  });
}

// ─── Receipts ────────────────────────────────────────────────────────────────

export function useReceipts(params = {}) {
  return useQuery({
    queryKey: ["receipts", params],
    queryFn: () => salesApi.receipts(params),
  });
}

export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => salesApi.createReceipt(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });
}
