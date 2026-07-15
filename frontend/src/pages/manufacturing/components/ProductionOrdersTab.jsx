import { useState, useMemo } from "react";
import { useManufacturingStore } from "../hooks/useManufacturingStore";
import { Search, Filter, Plus, ChevronDown, Check, Columns, Trash2, Edit2, Play, CheckCircle2, AlertCircle, FileSpreadsheet, RefreshCw, X, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";

const STATUS_BADGES = {
  DRAFT: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  PLANNING: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  DELAYED: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
};

const PRIORITY_COLORS = {
  LOW: "text-slate-500 bg-slate-50 border-slate-200",
  MEDIUM: "text-blue-600 bg-blue-50 border-blue-100",
  HIGH: "text-amber-700 bg-amber-50 border-amber-200",
  URGENT: "text-rose-700 bg-rose-50 border-rose-200",
};

export function ProductionOrdersTab() {
  const { productionOrders, addProductionOrder, deleteProductionOrder, updateProductionOrder } = useManufacturingStore();

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");

  // Selection & Columns State
  const [selectedIds, setSelectedIds] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [columns, setColumns] = useState({
    id: { label: "Order ID", visible: true },
    product: { label: "Product Name", visible: true },
    quantity: { label: "Quantity", visible: true },
    deadline: { label: "Deadline", visible: true },
    status: { label: "Status", visible: true },
    priority: { label: "Priority", visible: true },
    progress: { label: "Progress", visible: true },
    assignedWorker: { label: "Assigned To", visible: true },
    createdAt: { label: "Created Date", visible: false },
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Dialog State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    product: "MEMS Pressure Sensor - 1.2 bar",
    code: "MEMS-PRESS-V3",
    quantity: 1000,
    priority: "MEDIUM",
    deadline: "2026-07-25",
    assignedWorker: "Rahul Kulkarni",
    notes: "",
  });

  // Import Ref
  const [importStatus, setImportStatus] = useState(null);

  // Computed orders list
  const filteredOrders = useMemo(() => {
    let result = [...productionOrders];

    // Search query filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q) ||
          o.assignedWorker.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((o) => o.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== "ALL") {
      result = result.filter((o) => o.priority === priorityFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [productionOrders, searchQuery, statusFilter, priorityFilter, sortBy, sortOrder]);

  // Paginated Orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  // Handle Sort Change
  const requestSort = (key) => {
    let order = "asc";
    if (sortBy === key && sortOrder === "asc") {
      order = "desc";
    }
    setSortBy(key);
    setSortOrder(order);
  };

  // Row selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedOrders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} orders?`)) {
      selectedIds.forEach((id) => deleteProductionOrder(id));
      setSelectedIds([]);
    }
  };

  const handleBulkStatusChange = (status) => {
    selectedIds.forEach((id) => updateProductionOrder(id, { status }));
    setSelectedIds([]);
  };

  // Export to Excel File using SheetJS
  const handleExport = () => {
    const dataToExport = filteredOrders.map((o) => ({
      "Order ID": o.id,
      "Product": o.product,
      "Code": o.code,
      "Quantity": o.quantity,
      "Deadline": o.deadline,
      "Status": o.status,
      "Priority": o.priority,
      "Progress %": o.progress,
      "Assigned Operator": o.assignedWorker,
      "Created Date": o.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Production Orders");
    XLSX.writeFile(workbook, `Velora_Production_Orders_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Import Mock Action (JSON/CSV simulation)
  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx,.xls";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setImportStatus("reading");
        setTimeout(() => {
          // Simulate adding imported rows
          addProductionOrder({
            product: "MEMS Microphone - Analog",
            code: "MEMS-MIC-AN",
            quantity: 3500,
            priority: "MEDIUM",
            deadline: "2026-07-28",
            assignedWorker: "Madhuri Joshi",
            notes: "Imported run lot calibration completed.",
          });
          setImportStatus("success");
          setTimeout(() => setImportStatus(null), 3000);
        }, 1200);
      }
    };
    input.click();
  };

  // Create Order Submit
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    addProductionOrder(newOrder);
    setShowCreateModal(false);
    // Reset form
    setNewOrder({
      product: "MEMS Pressure Sensor - 1.2 bar",
      code: "MEMS-PRESS-V3",
      quantity: 1000,
      priority: "MEDIUM",
      deadline: "2026-07-25",
      assignedWorker: "Rahul Kulkarni",
      notes: "",
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Sub-Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search by Order ID, Product, or Assigned Worker..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50">
            <SlidersHorizontal size={14} className="text-slate-500" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent font-bold outline-none cursor-pointer text-slate-900"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PLANNING">Planning</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELAYED">Delayed</option>
            </select>
          </div>

          {/* Priority filter dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50">
            <Filter size={14} className="text-slate-500" />
            <span>Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent font-bold outline-none cursor-pointer text-slate-900"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Column Customizer Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Columns size={14} />
              Columns
              <ChevronDown size={12} />
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 z-50 w-48 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-2 mb-2">Display Columns</p>
                <div className="space-y-1">
                  {Object.keys(columns).map((key) => (
                    <label key={key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs text-slate-700 font-medium select-none">
                      <input
                        type="checkbox"
                        checked={columns[key].visible}
                        onChange={(e) =>
                          setColumns((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], visible: e.target.checked },
                          }))
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      {columns[key].label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Excel Export & Import */}
          <button
            onClick={handleExport}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            Export
          </button>

          <button
            onClick={handleImportClick}
            disabled={importStatus === "reading"}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={`text-blue-600 ${importStatus === "reading" ? "animate-spin" : ""}`} />
            {importStatus === "reading" ? "Importing..." : importStatus === "success" ? "Success!" : "Import"}
          </button>

          {/* Create Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-900 shadow-sm"
          >
            <Plus size={14} />
            Create Order
          </button>
        </div>
      </div>

      {/* Bulk Action Panel (Active when rows are selected) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5 text-white animate-fade-in shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">
              {selectedIds.length} orders selected
            </span>
            <div className="h-4 w-px bg-slate-800" />
            <button
              onClick={() => handleBulkStatusChange("IN_PROGRESS")}
              className="inline-flex items-center gap-1 text-xs text-indigo-400 font-semibold hover:text-indigo-300"
            >
              <Play size={13} />
              Run Lots
            </button>
            <button
              onClick={() => handleBulkStatusChange("COMPLETED")}
              className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold hover:text-emerald-300"
            >
              <CheckCircle2 size={13} />
              Complete Lots
            </button>
          </div>
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1 text-xs text-rose-400 font-semibold hover:text-rose-300"
          >
            <Trash2 size={13} />
            Delete Selected
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedOrders.length > 0 &&
                      paginatedOrders.every((o) => selectedIds.includes(o.id))
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                </th>
                {columns.id.visible && (
                  <th className="px-4 py-3.5 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("id")}>
                    Order ID {sortBy === "id" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                )}
                {columns.product.visible && (
                  <th className="px-4 py-3.5 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("product")}>
                    Product {sortBy === "product" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                )}
                {columns.quantity.visible && (
                  <th className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 text-right" onClick={() => requestSort("quantity")}>
                    Qty {sortBy === "quantity" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                )}
                {columns.progress.visible && (
                  <th className="px-4 py-3.5">Progress</th>
                )}
                {columns.status.visible && (
                  <th className="px-4 py-3.5 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("status")}>
                    Status {sortBy === "status" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                )}
                {columns.priority.visible && (
                  <th className="px-4 py-3.5 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("priority")}>
                    Priority {sortBy === "priority" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                )}
                {columns.assignedWorker.visible && (
                  <th className="px-4 py-3.5 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("assignedWorker")}>
                    Assigned Worker {sortBy === "assignedWorker" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                )}
                {columns.deadline.visible && (
                  <th className="px-4 py-3.5 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("deadline")}>
                    Deadline {sortBy === "deadline" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                )}
                {columns.createdAt.visible && (
                  <th className="px-4 py-3.5">Created Date</th>
                )}
                <th className="px-4 py-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    No production orders found matching the filters.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => {
                  const isSelected = selectedIds.includes(o.id);
                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-slate-50 transition ${
                        isSelected ? "bg-slate-50/70" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(o.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                      </td>
                      {columns.id.visible && (
                        <td className="px-4 py-3.5 font-bold text-slate-900 tabular-nums">
                          {o.id}
                        </td>
                      )}
                      {columns.product.visible && (
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          <div>
                            <p>{o.product}</p>
                            <p className="text-[10px] text-slate-400">{o.code}</p>
                          </div>
                        </td>
                      )}
                      {columns.quantity.visible && (
                        <td className="px-4 py-3.5 font-semibold text-slate-900 text-right tabular-nums">
                          {o.quantity.toLocaleString()}
                        </td>
                      )}
                      {columns.progress.visible && (
                        <td className="px-4 py-3.5 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden flex-1">
                              <div
                                className={`h-full ${
                                  o.status === "COMPLETED"
                                    ? "bg-emerald-500"
                                    : o.status === "DELAYED"
                                    ? "bg-rose-500"
                                    : "bg-indigo-500"
                                }`}
                                style={{ width: `${o.progress}%` }}
                              />
                            </div>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {o.progress}%
                            </span>
                          </div>
                        </td>
                      )}
                      {columns.status.visible && (
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              STATUS_BADGES[o.status]
                            }`}
                          >
                            {o.status.replace("_", " ")}
                          </span>
                        </td>
                      )}
                      {columns.priority.visible && (
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                              PRIORITY_COLORS[o.priority]
                            }`}
                          >
                            {o.priority}
                          </span>
                        </td>
                      )}
                      {columns.assignedWorker.visible && (
                        <td className="px-4 py-3.5 font-medium text-slate-700">
                          {o.assignedWorker}
                        </td>
                      )}
                      {columns.deadline.visible && (
                        <td className="px-4 py-3.5 font-medium text-slate-600 tabular-nums">
                          {o.deadline}
                        </td>
                      )}
                      {columns.createdAt.visible && (
                        <td className="px-4 py-3.5 font-medium text-slate-400 tabular-nums">
                          {o.createdAt}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          {o.status !== "COMPLETED" && o.status !== "IN_PROGRESS" && (
                            <button
                              onClick={() => updateProductionOrder(o.id, { status: "IN_PROGRESS", progress: 5 })}
                              className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 transition"
                              title="Start Run"
                            >
                              <Play size={14} />
                            </button>
                          )}
                          {o.status === "IN_PROGRESS" && (
                            <button
                              onClick={() => updateProductionOrder(o.id, { status: "COMPLETED", progress: 100 })}
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition"
                              title="Mark Done"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const newProg = prompt("Enter progress percent (0-100):", o.progress);
                              if (newProg !== null) {
                                const progNum = parseInt(newProg);
                                if (!isNaN(progNum) && progNum >= 0 && progNum <= 100) {
                                  updateProductionOrder(o.id, {
                                    progress: progNum,
                                    status: progNum === 100 ? "COMPLETED" : o.status,
                                  });
                                }
                              }
                            }}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition"
                            title="Edit Progress"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this order?")) deleteProductionOrder(o.id);
                            }}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 transition"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Sub-Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 outline-none text-slate-700 bg-slate-50 font-semibold"
            >
              <option value={5}>5 items</option>
              <option value={10}>10 items</option>
              <option value={20}>20 items</option>
            </select>
            <span>of {filteredOrders.length} orders</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((c) => c - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-slate-700 px-3">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((c) => c + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE ORDER MODAL DIALOG */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Create Production Order</h3>
                <p className="text-xs text-slate-500">Initiate a new production wafer lot line</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Product</label>
                  <select
                    value={newOrder.product}
                    onChange={(e) => {
                      const prods = {
                        "MEMS Pressure Sensor - 1.2 bar": "MEMS-PRESS-V3",
                        "MEMS Accelerometer - 3-axis": "MEMS-ACCEL-A2",
                        "MEMS Microphone - Analog": "MEMS-MIC-AN",
                        "MEMS Gyroscope - Industrial": "MEMS-GYRO-IND"
                      };
                      setNewOrder({
                        ...newOrder,
                        product: e.target.value,
                        code: prods[e.target.value],
                      });
                    }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="MEMS Pressure Sensor - 1.2 bar">MEMS Pressure Sensor - 1.2 bar</option>
                    <option value="MEMS Accelerometer - 3-axis">MEMS Accelerometer - 3-axis</option>
                    <option value="MEMS Microphone - Analog">MEMS Microphone - Analog</option>
                    <option value="MEMS Gyroscope - Industrial">MEMS Gyroscope - Industrial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Lot Volume (Qty)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newOrder.quantity}
                    onChange={(e) => setNewOrder({ ...newOrder, quantity: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 5000"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Priority</label>
                  <select
                    value={newOrder.priority}
                    onChange={(e) => setNewOrder({ ...newOrder, priority: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target Deadline</label>
                  <input
                    type="date"
                    required
                    value={newOrder.deadline}
                    onChange={(e) => setNewOrder({ ...newOrder, deadline: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assigned Operator</label>
                <select
                  value={newOrder.assignedWorker}
                  onChange={(e) => setNewOrder({ ...newOrder, assignedWorker: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500"
                >
                  <option value="Rahul Kulkarni">Rahul Kulkarni (Line A Stepper)</option>
                  <option value="Siddharth Patil">Siddharth Patil (Line B DRIE)</option>
                  <option value="Madhuri Joshi">Madhuri Joshi (Line C Bonder)</option>
                  <option value="Anil Sharma">Anil Sharma (Line D Test)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Process Notes / Specs</label>
                <textarea
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                  placeholder="Silicon substrate orientation specifications, sputter thickness details, target yield ratios..."
                  className="w-full min-h-[70px] rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-900"
                >
                  Create Lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
