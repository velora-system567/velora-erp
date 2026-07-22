import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download } from "lucide-react";
import { inventoryApi } from "../../../services/api";
import { formatRupees } from "../../../utils/money";
import { ErrorState } from "../../../components/ErrorState";
import { SkeletonTable } from "../../../components/Skeleton";
import { SecondaryButton } from "../../../components/PageHeader";
import { Cell, Head, Pill, TableShell, number, exportCsv } from "./shared";

export default function StockTable({ warehouseId, search }) {
  const [sortBy, setSortBy] = useState("name");
  const [selected, setSelected] = useState([]);

  const query = useQuery({
    queryKey: ["stock-summary", warehouseId],
    queryFn: () => inventoryApi.stockSummary(warehouseId ? { warehouseId } : {}),
    staleTime: 60 * 1000,
  });

  if (query.isPending) return <SkeletonTable rows={8} cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const rows = useMemo(() => {
    const list = (query.data?.data || []).filter(
      (row) => `${row.item?.itemCode || ""} ${row.item?.name || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
    list.sort((a, b) =>
      sortBy === "quantity"
        ? Number(b.quantity) - Number(a.quantity)
        : (a.item?.name || "").localeCompare(b.item?.name || "")
    );
    return list;
  }, [query.data, search, sortBy]);

  const toggleAll = () =>
    setSelected(selected.length === rows.length ? [] : rows.map((r) => `${r.itemId}::${r.warehouseId}`));
  const isSelected = (row) => selected.includes(`${row.itemId}::${row.warehouseId}`);
  const toggleRow = (row) => {
    const key = `${row.itemId}::${row.warehouseId}`;
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };
  const exportData = rows.filter((r) => !selected.length || selected.includes(`${r.itemId}::${r.warehouseId}`));

  const whName = (row) => row.warehouse?.name || row.warehouseId;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {number(rows.length)} stock balance{rows.length === 1 ? "" : "s"}
          {selected.length ? ` · ${selected.length} selected` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {selected.length > 0 && <Pill tone="blue">{selected.length} row{selected.length === 1 ? "" : "s"} selected</Pill>}
          <SecondaryButton
            label="Export CSV"
            icon={Download}
            onClick={() =>
              exportCsv("velora-stock-summary.csv", exportData, [
                { label: "SKU", value: (r) => r.item?.itemCode },
                { label: "Product", value: (r) => r.item?.name },
                { label: "Warehouse", value: (r) => whName(r) },
                { label: "Quantity", value: (r) => r.quantity },
                { label: "FIFO value (₹)", value: (r) => (r.valuePaise / 100).toFixed(2) },
              ])
            }
          />
        </div>
      </div>
      <TableShell>
        <Head>
          <th className="w-12 px-4 py-3">
            <input
              aria-label="Select all"
              type="checkbox"
              checked={rows.length > 0 && selected.length === rows.length}
              onChange={toggleAll}
            />
          </th>
          <th className="px-4 py-3">
            <button className="inline-flex items-center gap-1" onClick={() => setSortBy("name")}>
              Product <ChevronDown size={13} />
            </button>
          </th>
          <th className="px-4 py-3">Warehouse</th>
          <th className="px-4 py-3 text-right">
            <button className="inline-flex items-center gap-1" onClick={() => setSortBy("quantity")}>
              On hand <ChevronDown size={13} />
            </button>
          </th>
          <th className="px-4 py-3 text-right">FIFO value</th>
        </Head>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? (
            rows.map((row) => (
              <tr key={`${row.itemId}-${row.warehouseId}`} className="hover:bg-slate-50">
                <Cell>
                  <input
                    aria-label={`Select ${row.item?.name || row.itemId}`}
                    type="checkbox"
                    checked={isSelected(row)}
                    onChange={() => toggleRow(row)}
                  />
                </Cell>
                <Cell>
                  <p className="font-medium text-slate-950">{row.item?.name || "Unknown item"}</p>
                  <p className="font-mono text-xs text-slate-500">{row.item?.itemCode || row.itemId}</p>
                </Cell>
                <Cell className="font-mono text-xs text-slate-600">
                  {row.warehouse?.name || "—"}
                </Cell>
                <Cell
                  className={`text-right font-semibold tabular-nums ${
                    Number(row.quantity) <= 0 ? "text-rose-700" : "text-slate-950"
                  }`}
                >
                  {number(row.quantity, 3)}
                </Cell>
                <Cell className="text-right font-semibold tabular-nums text-slate-900">
                  {formatRupees(row.valuePaise)}
                </Cell>
              </tr>
            ))
          ) : (
            <tr>
              <Cell className="py-12 text-center text-slate-500" colSpan={5}>
                No stock balance matches the selected filters.
              </Cell>
            </tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
