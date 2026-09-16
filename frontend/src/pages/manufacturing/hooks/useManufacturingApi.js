/**
 * React-Query hooks for Manufacturing API integration.
 * Used by Manufacturing tab components to load live data directly from backend.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { manufacturingApi, masterApi } from "../../../services/api";
import { tenantKey } from "../../../utils/reactQueryTenant";

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function useManufacturingDashboard() {
  return useQuery({
    queryKey: tenantKey(["mfg-dashboard"]),
    queryFn: manufacturingApi.dashboard,
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export function useManufacturingAnalytics() {
  return useQuery({
    queryKey: tenantKey(["mfg-analytics"]),
    queryFn: manufacturingApi.analytics,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ─── Production Orders ────────────────────────────────────────────────────────
export function useProductionOrders(params = {}) {
  return useQuery({
    queryKey: tenantKey(["mfg-production-orders", params]),
    queryFn: () => manufacturingApi.productionOrders(params),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateProductionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: manufacturingApi.createProductionOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-production-orders"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-analytics"]) });
    },
  });
}

export function useUpdateProductionOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => manufacturingApi.updateProductionOrderStatus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-production-orders"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-analytics"]) });
    },
  });
}

// ─── BOMs ─────────────────────────────────────────────────────────────────────
export function useBoms(params = {}) {
  return useQuery({
    queryKey: tenantKey(["mfg-boms", params]),
    queryFn: () => manufacturingApi.boms(params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCreateBom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: manufacturingApi.createBom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-boms"]) });
    },
  });
}

export function useDeleteBom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => manufacturingApi.deleteBom(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-boms"]) });
    },
  });
}

// ─── Machines ─────────────────────────────────────────────────────────────────
export function useMachines(params = {}) {
  return useQuery({
    queryKey: tenantKey(["mfg-machines", params]),
    queryFn: () => manufacturingApi.machines(params),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useCreateMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: manufacturingApi.createMachine,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-machines"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
    },
  });
}

export function useUpdateMachineStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => manufacturingApi.updateMachineStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-machines"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
    },
  });
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export function useMaintenance(params = {}) {
  return useQuery({
    queryKey: tenantKey(["mfg-maintenance", params]),
    queryFn: () => manufacturingApi.maintenance(params),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: manufacturingApi.createMaintenance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-maintenance"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-analytics"]) });
    },
  });
}

export function useCompleteMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => manufacturingApi.completeMaintenance(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-maintenance"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-analytics"]) });
    },
  });
}

// ─── Quality Checks ───────────────────────────────────────────────────────────
export function useQualityChecks(params = {}) {
  return useQuery({
    queryKey: tenantKey(["mfg-quality", params]),
    queryFn: () => manufacturingApi.qualityChecks(params),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateQualityCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: manufacturingApi.createQualityCheck,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-quality"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-analytics"]) });
    },
  });
}

// ─── Work Orders ──────────────────────────────────────────────────────────────
export function useWorkOrders(params = {}) {
  return useQuery({
    queryKey: tenantKey(["mfg-work-orders", params]),
    queryFn: () => manufacturingApi.workOrders(params),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: manufacturingApi.createWorkOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-work-orders"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-analytics"]) });
    },
  });
}

export function useCompleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => manufacturingApi.completeWorkOrder(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-work-orders"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-dashboard"]) });
      qc.invalidateQueries({ queryKey: tenantKey(["mfg-analytics"]) });
    },
  });
}

// ─── Items (Master Data) ──────────────────────────────────────────────────────
export function useManufacturingItems() {
  return useQuery({
    queryKey: tenantKey(["master-items"]),
    queryFn: () => masterApi.list("items", { limit: 100 }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
