/**
 * React-Query hooks for Manufacturing API integration.
 * Used by Manufacturing tab components to load live data
 * alongside the Zustand local store for offline/optimistic UX.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { manufacturingApi } from "../../../services/api";

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function useManufacturingDashboard() {
  return useQuery({
    queryKey: ["mfg-dashboard"],
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
    queryKey: ["mfg-analytics"],
    queryFn: manufacturingApi.analytics,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ─── Production Orders ────────────────────────────────────────────────────────
export function useProductionOrders(params = {}) {
  return useQuery({
    queryKey: ["mfg-production-orders", params],
    queryFn: () => manufacturingApi.productionOrders(params),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useUpdateProductionOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => manufacturingApi.updateProductionOrderStatus(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mfg-production-orders"] }),
  });
}

// ─── BOMs ─────────────────────────────────────────────────────────────────────
export function useBoms() {
  return useQuery({
    queryKey: ["mfg-boms"],
    queryFn: () => manufacturingApi.boms(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Machines ─────────────────────────────────────────────────────────────────
export function useMachines() {
  return useQuery({
    queryKey: ["mfg-machines"],
    queryFn: () => manufacturingApi.machines(),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useUpdateMachineStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => manufacturingApi.updateMachineStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mfg-machines"] }),
  });
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export function useMaintenance(params = {}) {
  return useQuery({
    queryKey: ["mfg-maintenance", params],
    queryFn: () => manufacturingApi.maintenance(params),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: manufacturingApi.createMaintenance,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mfg-maintenance"] }),
  });
}

export function useCompleteMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => manufacturingApi.completeMaintenance(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mfg-maintenance"] }),
  });
}

// ─── Quality Checks ───────────────────────────────────────────────────────────
export function useQualityChecks() {
  return useQuery({
    queryKey: ["mfg-quality"],
    queryFn: () => manufacturingApi.qualityChecks(),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCreateQualityCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: manufacturingApi.createQualityCheck,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mfg-quality"] }),
  });
}

// ─── Work Orders ──────────────────────────────────────────────────────────────
export function useWorkOrders(params = {}) {
  return useQuery({
    queryKey: ["mfg-work-orders", params],
    queryFn: () => manufacturingApi.workOrders(params),
    staleTime: 60 * 1000,
    retry: 1,
  });
}
