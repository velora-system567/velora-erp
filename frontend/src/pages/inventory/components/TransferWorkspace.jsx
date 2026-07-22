import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Truck } from "lucide-react";
import { inventoryApi } from "../../../services/api";
import { ErrorBanner } from "../../../components/ErrorState";
import { Card, SectionHeader } from "./shared";

export default function TransferWorkspace({ warehouses, items, onPosted }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState("transfer");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    itemId: "", fromWarehouseId: "", toWarehouseId: "", warehouseId: "",
    quantity: "", adjustmentQty: "", reason: "", costRate: "",
  });
  const [openingForm, setOpeningForm] = useState({
    warehouseId: "", itemId: "", quantity: "", costRate: "", batchNumber: "",
  });
  const [openingRows, setOpeningRows] = useState([]);

  const mutation = useMutation({
    mutationFn: () =>
      mode === "transfer"
        ? inventoryApi.createTransfer({
            itemId: form.itemId,
            fromWarehouseId: form.fromWarehouseId,
            toWarehouseId: form.toWarehouseId,
            quantity: Number(form.quantity),
          })
        : inventoryApi.createAdjustment({
            itemId: form.itemId,
            warehouseId: form.warehouseId,
            adjustmentQty: Number(form.adjustmentQty),
            reason: form.reason,
            costRate: form.costRate ? Number(form.costRate) : undefined,
          }),
    onSuccess: () => {
      setNotice(mode === "transfer" ? "Transfer posted successfully." : "Stock adjustment posted successfully.");
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory-dashboard-v2"] });
      qc.invalidateQueries({ queryKey: ["inventory-ledger"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      onPosted?.();
    },
  });

  const openingMutation = useMutation({
    mutationFn: () =>
      inventoryApi.openingStock({ warehouseId: openingForm.warehouseId, items: openingRows }),
    onSuccess: () => {
      setNotice("Opening stock posted successfully.");
      setOpeningRows([]);
      setOpeningForm({ warehouseId: "", itemId: "", quantity: "", costRate: "", batchNumber: "" });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory-dashboard-v2"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      onPosted?.();
    },
  });

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const updateOpening = (key) => (e) =>
    setOpeningForm({ ...openingForm, [key]: e.target.value });

  const productSelect = (key = "itemId") => (
    <select
      required
      value={form[key]}
      onChange={update(key)}
      className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3"
    >
      <option value="">Select product</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.itemCode} · {item.name}
        </option>
      ))}
    </select>
  );

  const warehouseSelect = (key, label) => (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        required
        value={form[key]}
        onChange={update(key)}
        className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3"
      >
        <option value="">Select warehouse</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </label>
  );

  const addOpeningRow = () => {
    if (!openingForm.itemId || !openingForm.quantity || !openingForm.costRate) return;
    const item = items.find((i) => i.id === openingForm.itemId);
    if (!item) return;
    setOpeningRows([
      ...openingRows,
      {
        itemId: openingForm.itemId,
        quantity: Number(openingForm.quantity),
        costRate: Number(openingForm.costRate),
        batchNumber: openingForm.batchNumber || "",
      },
    ]);
    setOpeningForm({ ...openingForm, itemId: "", quantity: "", costRate: "", batchNumber: "" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader
          title="Stock operations"
          description="Move stock between warehouses, correct balances, or post opening stock."
          icon={Truck}
        />
        <div className="grid grid-cols-3 gap-2">
          {["transfer", "adjustment", "opening"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setNotice(""); }}
              className={`min-h-11 rounded-lg text-sm font-semibold ${
                mode === m ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {m === "transfer" ? "Transfer" : m === "adjustment" ? "Adjustment" : "Opening stock"}
            </button>
          ))}
        </div>
      </Card>

      {mode !== "opening" ? (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setNotice("");
              mutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Product{productSelect("itemId")}
              </label>
              {mode === "transfer" ? (
                <>
                  {warehouseSelect("fromWarehouseId", "From warehouse")}
                  {warehouseSelect("toWarehouseId", "To warehouse")}
                  <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                    Quantity
                    <input
                      required
                      min="0.001"
                      step="0.001"
                      type="number"
                      value={form.quantity}
                      onChange={update("quantity")}
                      className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                    Warehouse
                    <select
                      required
                      value={form.warehouseId}
                      onChange={update("warehouseId")}
                      className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3"
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Quantity change
                    <input
                      required
                      step="0.001"
                      type="number"
                      value={form.adjustmentQty}
                      onChange={update("adjustmentQty")}
                      className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Unit cost (₹, optional)
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={form.costRate}
                      onChange={update("costRate")}
                      className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                    Reason
                    <textarea
                      required
                      minLength={3}
                      value={form.reason}
                      onChange={update("reason")}
                      className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 p-3"
                    />
                  </label>
                </>
              )}
            </div>
            {mutation.error && <div className="mt-4"><ErrorBanner error={mutation.error} /></div>}
            {notice && (
              <p aria-live="polite" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                {notice}
              </p>
            )}
            <button
              disabled={mutation.isPending}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send size={16} />
              {mutation.isPending
                ? "Posting…"
                : mode === "transfer"
                ? "Post transfer"
                : "Post adjustment"}
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Warehouse
              <select
                required
                value={openingForm.warehouseId}
                onChange={updateOpening("warehouseId")}
                className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Product
              <select
                value={openingForm.itemId}
                onChange={updateOpening("itemId")}
                className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3"
              >
                <option value="">Select product</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemCode} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Quantity
              <input
                min="0.001"
                step="0.001"
                type="number"
                value={openingForm.quantity}
                onChange={updateOpening("quantity")}
                className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Unit cost (₹)
              <input
                min="0"
                step="0.01"
                type="number"
                value={openingForm.costRate}
                onChange={updateOpening("costRate")}
                className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Batch / lot (optional)
              <input
                value={openingForm.batchNumber}
                onChange={updateOpening("batchNumber")}
                className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={addOpeningRow}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={16} /> Add to opening stock
          </button>
          {openingRows.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {openingRows.length} item{openingRows.length === 1 ? "" : "s"} ready to post
              </p>
              <div className="space-y-1.5">
                {openingRows.map((row, idx) => {
                  const item = items.find((i) => i.id === row.itemId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{item?.name || "Item"}</p>
                        <p className="text-xs text-slate-500">
                          Batch {row.batchNumber || "—"} · Qty {row.quantity} · ₹{row.costRate}
                        </p>
                      </div>
                      <button
                        onClick={() => setOpeningRows(openingRows.filter((_, i) => i !== idx))}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {openingMutation.error && <div className="mt-4"><ErrorBanner error={openingMutation.error} /></div>}
          {notice && (
            <p aria-live="polite" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              {notice}
            </p>
          )}
          <button
            disabled={openingMutation.isPending || openingRows.length === 0 || !openingForm.warehouseId}
            onClick={() => {
              setNotice("");
              openingMutation.mutate();
            }}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={16} />
            {openingMutation.isPending
              ? "Posting…"
              : `Post ${openingRows.length} opening balance${openingRows.length === 1 ? "" : "s"}`}
          </button>
        </Card>
      )}
    </div>
  );
}
