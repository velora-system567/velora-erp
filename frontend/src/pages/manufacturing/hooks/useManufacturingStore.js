import { create } from "zustand";

const NOW = new Date("2026-07-14T09:30:00+05:30");

function hoursAgo(hours) {
  const d = new Date(NOW.getTime() - hours * 60 * 60 * 1000);
  return d.toISOString();
}

function inDays(days, hour = 9, minute = 30) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const useManufacturingStore = create((set, get) => ({
  // Core Shopfloor Metadata
  factory: {
    name: "Velora MEMS Plant - Pune",
    shift: "Shift A - 06:00 to 14:00 IST",
    currentTime: NOW.toISOString(),
    workingHours: { start: "06:00", end: "14:00" },
    operatorsOnDuty: 42,
    operatorsScheduled: 48,
  },

  // Composite plant health metrics
  plantHealth: {
    score: 86,
    status: "Healthy",
    trend: [78, 80, 79, 82, 84, 83, 85, 86],
    factors: [
      { label: "OEE", value: 78, target: 85, weight: 0.3 },
      { label: "Quality", value: 97.2, target: 98, weight: 0.25 },
      { label: "On-time delivery", value: 93, target: 95, weight: 0.2 },
      { label: "Material readiness", value: 88, target: 95, weight: 0.15 },
      { label: "Safety", value: 100, target: 100, weight: 0.1 },
    ],
  },

  // Today's summary KPIs
  summaryKpis: [
    { id: "kpi-oee", label: "OEE", value: 78.4, suffix: "%", delta: -1.6, target: 85, intent: "warning", spark: [72, 74, 76, 75, 78, 77, 78, 78.4] },
    { id: "kpi-quality", label: "Quality pass rate", value: 96.9, suffix: "%", delta: 0.3, target: 98, intent: "positive", spark: [96.1, 96.4, 95.8, 97.0, 96.6, 97.2, 96.9] },
    { id: "kpi-util", label: "Machine utilization", value: 71.5, suffix: "%", delta: 2.1, target: 80, intent: "positive", spark: [66, 68, 70, 69, 71, 72, 71.5] },
    { id: "kpi-scrap", label: "Scrap rate", value: 3.1, suffix: "%", delta: -0.2, target: 2.5, intent: "negative", spark: [3.9, 3.6, 4.2, 3.0, 3.4, 2.8, 3.1] },
  ],

  // Today's production timeline
  todayProduction: {
    planned: 12400,
    actual: 11240,
    units: "dies",
    good: 10895,
    scrap: 345,
    trend: [
      { hour: "06", planned: 1200, actual: 1180 },
      { hour: "07", planned: 1450, actual: 1390 },
      { hour: "08", planned: 1500, actual: 1465 },
      { hour: "09", planned: 1600, actual: 1480 },
      { hour: "10", planned: 1700, actual: 0 },
      { hour: "11", planned: 1700, actual: 0 },
      { hour: "12", planned: 1650, actual: 0 },
      { hour: "13", planned: 1600, actual: 0 },
    ],
  },

  // Production Orders List
  productionOrders: [
    { id: "PO-2026-001", product: "MEMS Pressure Sensor - 1.2 bar", code: "MEMS-PRESS-V3", quantity: 8000, progress: 76, status: "IN_PROGRESS", priority: "HIGH", assignedWorker: "Rahul Kulkarni", deadline: "2026-07-20", createdAt: "2026-07-10", notes: "First production run for Aarav Automotive Pvt. Ltd." },
    { id: "PO-2026-002", product: "MEMS Accelerometer - 3-axis", code: "MEMS-ACCEL-A2", quantity: 5000, progress: 90, status: "IN_PROGRESS", priority: "MEDIUM", assignedWorker: "Siddharth Patil", deadline: "2026-07-18", createdAt: "2026-07-09", notes: "Bolt Mobility Systems pilot order." },
    { id: "PO-2026-003", product: "MEMS Microphone - Analog", code: "MEMS-MIC-AN", quantity: 15000, progress: 40, status: "PLANNING", priority: "URGENT", assignedWorker: "Madhuri Joshi", deadline: "2026-07-25", createdAt: "2026-07-12", notes: "High volume contract for Echo Wearables." },
    { id: "PO-2026-004", product: "MEMS Gyroscope - Industrial", code: "MEMS-GYRO-IND", quantity: 2000, progress: 24, status: "DELAYED", priority: "HIGH", assignedWorker: "Anil Sharma", deadline: "2026-07-15", createdAt: "2026-07-08", notes: "Zenith Drones shipment. Slowed down by DRIE calibration issues." },
    { id: "PO-2026-005", product: "MEMS Flow Sensor - Medical", code: "MEMS-FLOW-MED", quantity: 1200, progress: 100, status: "COMPLETED", priority: "MEDIUM", assignedWorker: "Vikram Desai", deadline: "2026-07-12", createdAt: "2026-07-05", notes: "Delivered to Nivara Health. Fully approved by QA." },
    { id: "PO-2026-006", product: "MEMS Temp Sensor - Subsea", code: "MEMS-TEMP-SUB", quantity: 800, progress: 0, status: "DRAFT", priority: "LOW", assignedWorker: "Alok Sharma", deadline: "2026-08-01", createdAt: "2026-07-14", notes: "Deepsea exploration probe lot. Pending raw material silicon approval." },
  ],

  // Bill of Materials (BOM) Library
  boms: [
    {
      id: "BOM-PRESS-001",
      name: "BOM - MEMS Pressure Sensor v3.1",
      product: "MEMS Pressure Sensor - 1.2 bar",
      version: "v3.1",
      status: "ACTIVE",
      estimatedCost: 480.00,
      materialsCount: 6,
      history: [
        { version: "v3.1", date: "2026-05-12", author: "A. Sharma", description: "Updated WLP encapsulant density specs." },
        { version: "v3.0", date: "2025-11-20", author: "R. Kulkarni", description: "Initial release for mass manufacture." }
      ],
      components: [
        { sku: "WFR-SOI-200", name: "SOI Wafer 200mm - 725 micron", qty: 0.02, unit: "pcs", unitCost: 15000, availability: "Low Stock", required: 100 },
        { sku: "PR-AZ-9260", name: "Photoresist AZ 9260", qty: 0.005, unit: "liters", unitCost: 8000, availability: "Out of Stock", required: 25 },
        { sku: "TGT-AU-200", name: "Gold Sputtering Target 200mm", qty: 0.001, unit: "pcs", unitCost: 120000, availability: "In Stock", required: 5 },
        { sku: "GAS-SF6", name: "SF6 process gas (cylinder)", qty: 0.01, unit: "cylinders", unitCost: 22000, availability: "In Stock", required: 50 },
        { sku: "DCT-D8-200", name: "Dicing tape 8 inch", qty: 0.02, unit: "rolls", unitCost: 1800, availability: "In Stock", required: 100 },
        { sku: "CAP-WLP", name: "WLP encapsulant compound", qty: 0.015, unit: "kg", unitCost: 4500, availability: "In Stock", required: 75 }
      ]
    },
    {
      id: "BOM-ACCEL-002",
      name: "BOM - 3-Axis Accelerometer v2.4",
      product: "MEMS Accelerometer - 3-axis",
      version: "v2.4",
      status: "ACTIVE",
      estimatedCost: 320.00,
      materialsCount: 5,
      history: [
        { version: "v2.4", date: "2026-03-01", author: "V. Desai", description: "Substituted gold target with high-grade copper target to save cost." }
      ],
      components: [
        { sku: "WFR-SOI-200", name: "SOI Wafer 200mm - 725 micron", qty: 0.015, unit: "pcs", unitCost: 15000, availability: "Low Stock", required: 75 },
        { sku: "PR-AZ-9260", name: "Photoresist AZ 9260", qty: 0.004, unit: "liters", unitCost: 8000, availability: "Out of Stock", required: 20 },
        { sku: "TGT-CU-200", name: "Copper Sputtering Target 200mm", qty: 0.001, unit: "pcs", unitCost: 15000, availability: "In Stock", required: 5 },
        { sku: "GAS-SF6", name: "SF6 process gas (cylinder)", qty: 0.008, unit: "cylinders", unitCost: 22000, availability: "In Stock", required: 40 },
        { sku: "CAP-WLP", name: "WLP encapsulant compound", qty: 0.012, unit: "kg", unitCost: 4500, availability: "In Stock", required: 60 }
      ]
    },
    {
      id: "BOM-MIC-003",
      name: "BOM - Analog Microphone v1.0",
      product: "MEMS Microphone - Analog",
      version: "v1.0",
      status: "ACTIVE",
      estimatedCost: 140.00,
      materialsCount: 4,
      history: [
        { version: "v1.0", date: "2026-06-20", author: "M. Joshi", description: "First official micro-component BOM." }
      ],
      components: [
        { sku: "WFR-SOI-200", name: "SOI Wafer 200mm - 725 micron", qty: 0.01, unit: "pcs", unitCost: 15000, availability: "Low Stock", required: 150 },
        { sku: "PR-AZ-9260", name: "Photoresist AZ 9260", qty: 0.002, unit: "liters", unitCost: 8000, availability: "Out of Stock", required: 30 },
        { sku: "DCT-D8-200", name: "Dicing tape 8 inch", qty: 0.01, unit: "rolls", unitCost: 1800, availability: "In Stock", required: 150 },
        { sku: "CAP-WLP", name: "WLP encapsulant compound", qty: 0.008, unit: "kg", unitCost: 4500, availability: "In Stock", required: 120 }
      ]
    }
  ],

  // Work Orders List
  workOrders: [
    { id: "WO-2026-1042", orderId: "PO-2026-001", product: "MEMS Pressure Sensor - 1.2 bar", qtyPlanned: 2400, qtyCompleted: 1820, progress: 76, dueIn: "Today 16:00", line: "Line A - DUV", status: "ON_TRACK", stage: "Test", worker: "Rahul Kulkarni", machine: "TEST-04 - Wafer Prober", priority: "HIGH", dependencies: [] },
    { id: "WO-2026-1041", orderId: "PO-2026-002", product: "MEMS Accelerometer - 3-axis", qtyPlanned: 1800, qtyCompleted: 1620, progress: 90, dueIn: "Today 14:30", line: "Line B - DRIE", status: "ON_TRACK", stage: "Packaging", worker: "Siddharth Patil", machine: "PACK-02 - WLP Packager", priority: "MEDIUM", dependencies: ["WO-2026-1042"] },
    { id: "WO-2026-1040", orderId: "PO-2026-003", product: "MEMS Microphone - Analog", qtyPlanned: 5200, qtyCompleted: 3110, progress: 60, dueIn: "Tomorrow", line: "Line C - WLP", status: "SHORTAGE", stage: "Bonding", worker: "Madhuri Joshi", machine: "BOND-03 - Wafer Bonder", priority: "URGENT", dependencies: [] },
    { id: "WO-2026-1039", orderId: "PO-2026-004", product: "MEMS Gyroscope - Industrial", qtyPlanned: 900, qtyCompleted: 480, progress: 53, dueIn: "Overdue 6h", line: "Line A - DUV", status: "DELAYED", stage: "Etch (DRIE)", worker: "Anil Sharma", machine: "ETCH-02 - DRIE Etcher", priority: "HIGH", dependencies: [] },
    { id: "WO-2026-1038", orderId: "PO-2026-005", product: "MEMS Flow Sensor - Medical", qtyPlanned: 320, qtyCompleted: 320, progress: 100, dueIn: "Done", line: "Line D - Test", status: "COMPLETED", stage: "Dicing", worker: "Vikram Desai", machine: "DICE-01 - Automatic Dicer", priority: "MEDIUM", dependencies: [] },
  ],

  // Machines List
  machines: [
    { id: "LITH-01", name: "Photolithography - DUV Stepper", type: "Lithography", status: "RUNNING", utilization: 92, operatingHours: 4210, healthIndicator: 94, maintenanceDue: "2026-07-28", program: "MEMS-PRESS-V3" },
    { id: "ETCH-02", name: "DRIE Etcher", type: "Etching", status: "RUNNING", utilization: 87, operatingHours: 3890, healthIndicator: 89, maintenanceDue: "2026-07-16", program: "TSV-ETCH-A" },
    { id: "CMP-01", name: "CMP Polisher", type: "Polishing", status: "IDLE", utilization: 64, operatingHours: 2110, healthIndicator: 91, maintenanceDue: "2026-07-22", program: "Waiting for lot" },
    { id: "BOND-03", name: "Wafer Bonder", type: "Bonding", status: "RUNNING", utilization: 81, operatingHours: 5430, healthIndicator: 95, maintenanceDue: "2026-07-17", program: "ANISO-BOND" },
    { id: "DICE-01", name: "Automatic Dicer", type: "Dicing", status: "RUNNING", utilization: 73, operatingHours: 1980, healthIndicator: 92, maintenanceDue: "2026-07-20", program: "DICE-8UP" },
    { id: "TEST-04", name: "Wafer Prober", type: "Testing", status: "MAINTENANCE", utilization: 58, operatingHours: 6720, healthIndicator: 78, maintenanceDue: "2026-07-14", program: "PM scheduled" },
    { id: "PACK-02", name: "WLP Packager", type: "Packaging", status: "RUNNING", utilization: 69, operatingHours: 3200, healthIndicator: 87, maintenanceDue: "2026-07-25", program: "WLP-FANOUT" },
    { id: "INSP-05", name: "Optical Inspector", type: "Inspection", status: "BREAKDOWN", utilization: 48, operatingHours: 4190, healthIndicator: 62, maintenanceDue: "2026-07-14", program: "Laser alignment failure" },
  ],

  // Inventory Stocks & Usage Warnings
  inventoryConsumption: [
    { sku: "WFR-SOI-200", name: "SOI Wafer 200mm - 725 micron", onHand: 84, requiredStock: 120, unit: "pcs", daysOfStock: 2.1, vendor: "Silicon Quest Pvt. Ltd.", severity: "critical", usage: [8, 12, 14, 10, 15, 12, 11] },
    { sku: "PR-AZ-9260", name: "Photoresist AZ 9260", onHand: 2.4, requiredStock: 6, unit: "liters", daysOfStock: 4.0, vendor: "ResiChem India", severity: "critical", usage: [0.4, 0.5, 0.3, 0.6, 0.4, 0.8, 0.5] },
    { sku: "GAS-SF6", name: "SF6 process gas (cylinder)", onHand: 12, requiredStock: 30, unit: "cylinders", daysOfStock: 3.2, vendor: "Air Liquide India", severity: "warning", usage: [2, 3, 4, 2.5, 3.5, 4, 3] },
    { sku: "DCT-D8-200", name: "Dicing tape 8 inch", onHand: 18, requiredStock: 24, unit: "rolls", daysOfStock: 5.5, vendor: "TapeTech India", severity: "warning", usage: [2, 1, 3, 2, 2.5, 3, 1.5] },
    { sku: "CAP-WLP", name: "WLP encapsulant compound", onHand: 12, requiredStock: 15, unit: "kg", daysOfStock: 6.8, vendor: "PolyBond Materials", severity: "watch", usage: [1.2, 1.5, 1.1, 1.3, 1.4, 1.6, 1.2] },
  ],

  // Quality Control Records
  qualityRecords: [
    { id: "QC-2026-501", workOrderId: "WO-2026-1042", inspector: "S. Kulkarni", inspectedQty: 1000, passedQty: 972, failedQty: 28, passed: true, reworkQty: 12, defects: [{ code: "DF-12", label: "Bond alignment drift", count: 18 }, { code: "DF-04", label: "Etch depth variance", count: 10 }], date: "2026-07-14", notes: "Excursion caught early in Photolithography stepper shift A." },
    { id: "QC-2026-500", workOrderId: "WO-2026-1041", inspector: "V. Rane", inspectedQty: 500, passedQty: 485, failedQty: 15, passed: true, reworkQty: 5, defects: [{ code: "DF-21", label: "Contamination particles", count: 15 }], date: "2026-07-13", notes: "Lot approved. Airborne particle counter was high but within cleanroom Class 1000 limits." },
    { id: "QC-2026-499", workOrderId: "WO-2026-1039", inspector: "S. Kulkarni", inspectedQty: 300, passedQty: 280, failedQty: 20, passed: false, reworkQty: 18, defects: [{ code: "DF-09", label: "Dicing chip-out", count: 20 }], date: "2026-07-12", notes: "Dicing saw vibration exceeded limits. Critical failure on Zenith Gyroscope substrate. Rework ordered." },
    { id: "QC-2026-498", workOrderId: "WO-2026-1038", inspector: "A. Gupte", inspectedQty: 320, passedQty: 320, failedQty: 0, passed: true, reworkQty: 0, defects: [], date: "2026-07-12", notes: "Perfect yield for medical flow sensor batch. Standard compliance met." },
  ],

  // Maintenance Schedule & History
  maintenance: [
    { id: "MNT-092", machineId: "ETCH-02", machineName: "DRIE Etcher", task: "Chamber clean and seasoning", type: "PREVENTIVE", status: "SCHEDULED", scheduledDate: "2026-07-14", completedDate: null, owner: "Rahul Kulkarni", cost: 12500, notes: "Routine 100-hour clean. Gas feeds inspection needed." },
    { id: "MNT-091", machineId: "TEST-04", machineName: "Wafer Prober", task: "Probe card replacement", type: "CORRECTIVE", status: "IN_PROGRESS", scheduledDate: "2026-07-14", completedDate: null, owner: "Siddharth Patil", cost: 45000, notes: "Contact pins worn down. Alignment errors reported." },
    { id: "MNT-090", machineId: "BOND-03", machineName: "Wafer Bonder", task: "Anodic bond stack calibration", type: "PREVENTIVE", status: "SCHEDULED", scheduledDate: "2026-07-15", completedDate: null, owner: "Madhuri Joshi", cost: 8000, notes: "Semi-annual validation of thermal chamber seal." },
    { id: "MNT-089", machineId: "CMP-01", machineName: "CMP Polisher", type: "PREVENTIVE", task: "Slurry line flush", owner: "Vikram Desai", status: "COMPLETED", scheduledDate: "2026-07-12", completedDate: "2026-07-12", cost: 3500, notes: "Prevented drying slurry clogging on main feed lines." },
    { id: "MNT-088", machineId: "LITH-01", machineName: "Photolithography - DUV Stepper", type: "PREVENTIVE", task: "Lens inspection", owner: "Anil Sharma", status: "COMPLETED", scheduledDate: "2026-07-10", completedDate: "2026-07-10", cost: 95000, notes: "Regular inspection by certified ASML engineer." },
  ],

  // Live Activity Log
  logs: [
    { id: "ACT-441", who: "Rahul Kulkarni", action: "Logged PM completion for ETCH-02 chamber", when: hoursAgo(0.2), kind: "maintenance" },
    { id: "ACT-440", who: "Line A QC", action: "Released 480 dies from WO-2026-1042", when: hoursAgo(0.5), kind: "quality" },
    { id: "ACT-439", who: "System", action: "Auto-reorder raised for WFR-SOI-200", when: hoursAgo(0.8), kind: "system" },
    { id: "ACT-438", who: "Siddharth Patil", action: "Started WO-2026-1040 on Line C", when: hoursAgo(1.1), kind: "production" },
    { id: "ACT-437", who: "Madhuri Joshi", action: "Paused BOND-03 for anodic stack calibration", when: hoursAgo(1.4), kind: "maintenance" },
    { id: "ACT-436", who: "QA Lead", action: "Approved cleaning recipe v2.3 for Class 1000", when: hoursAgo(2.2), kind: "quality" },
    { id: "ACT-435", who: "Store", action: "Received 2 drums of SF6 - 49 cylinders", when: hoursAgo(3.0), kind: "inventory" },
  ],

  // CRUD Actions
  addProductionOrder: (order) => set((state) => {
    const newOrder = {
      id: `PO-2026-0${state.productionOrders.length + 1}`,
      createdAt: NOW.toISOString().split("T")[0],
      progress: 0,
      status: "DRAFT",
      ...order,
    };
    const log = {
      id: `ACT-${Date.now()}`,
      who: "Current Operator",
      action: `Created new Production Order ${newOrder.id} for ${newOrder.product}`,
      when: new Date().toISOString(),
      kind: "production",
    };
    return {
      productionOrders: [newOrder, ...state.productionOrders],
      logs: [log, ...state.logs],
    };
  }),

  deleteProductionOrder: (id) => set((state) => ({
    productionOrders: state.productionOrders.filter((o) => o.id !== id),
    logs: [
      {
        id: `ACT-${Date.now()}`,
        who: "Current Operator",
        action: `Deleted Production Order ${id}`,
        when: new Date().toISOString(),
        kind: "system",
      },
      ...state.logs,
    ],
  })),

  updateProductionOrder: (id, updates) => set((state) => ({
    productionOrders: state.productionOrders.map((o) => (o.id === id ? { ...o, ...updates } : o)),
  })),

  addBom: (bom) => set((state) => {
    const newBom = {
      id: `BOM-${Date.now().toString().slice(-4)}`,
      status: "ACTIVE",
      materialsCount: bom.components?.length || 0,
      history: [{ version: bom.version || "v1.0", date: NOW.toISOString().split("T")[0], author: "Current Operator", description: "Initial BOM Release" }],
      ...bom,
    };
    return {
      boms: [newBom, ...state.boms],
      logs: [
        {
          id: `ACT-${Date.now()}`,
          who: "Current Operator",
          action: `Registered new BOM ${newBom.id} for ${newBom.product}`,
          when: new Date().toISOString(),
          kind: "system",
        },
        ...state.logs,
      ],
    };
  }),

  addWorkOrder: (wo) => set((state) => {
    const newWo = {
      id: `WO-2026-${1000 + state.workOrders.length + 5}`,
      progress: 0,
      status: "ON_TRACK",
      ...wo,
    };
    return {
      workOrders: [newWo, ...state.workOrders],
      logs: [
        {
          id: `ACT-${Date.now()}`,
          who: "Current Operator",
          action: `Created Work Order ${newWo.id} on ${newWo.machine}`,
          when: new Date().toISOString(),
          kind: "production",
        },
        ...state.logs,
      ],
    };
  }),

  updateWorkOrderStage: (id, stage) => set((state) => {
    const wo = state.workOrders.find(w => w.id === id);
    if (!wo) return {};
    return {
      workOrders: state.workOrders.map((w) => (w.id === id ? { ...w, stage, status: stage === "Dicing" || stage === "Test" || stage === "Packaging" ? "ON_TRACK" : w.status } : w)),
      logs: [
        {
          id: `ACT-${Date.now()}`,
          who: "Current Operator",
          action: `Moved Work Order ${id} to stage: ${stage}`,
          when: new Date().toISOString(),
          kind: "production",
        },
        ...state.logs,
      ],
    };
  }),

  updateWorkOrderStatus: (id, status) => set((state) => {
    const wo = state.workOrders.find(w => w.id === id);
    if (!wo) return {};
    return {
      workOrders: state.workOrders.map((w) => (w.id === id ? { ...w, status, progress: status === "COMPLETED" ? 100 : w.progress } : w)),
      logs: [
        {
          id: `ACT-${Date.now()}`,
          who: "Current Operator",
          action: `Updated Work Order ${id} status to: ${status}`,
          when: new Date().toISOString(),
          kind: "production",
        },
        ...state.logs,
      ],
    };
  }),

  updateMachineStatus: (id, status) => set((state) => {
    const mac = state.machines.find(m => m.id === id);
    if (!mac) return {};
    return {
      machines: state.machines.map((m) => (m.id === id ? { ...m, status } : m)),
      logs: [
        {
          id: `ACT-${Date.now()}`,
          who: "Current Operator",
          action: `Updated Machine ${id} status to: ${status}`,
          when: new Date().toISOString(),
          kind: "maintenance",
        },
        ...state.logs,
      ],
    };
  }),

  addQualityRecord: (record) => set((state) => {
    const newRecord = {
      id: `QC-2026-${500 + state.qualityRecords.length + 2}`,
      inspector: "QA Lead",
      date: NOW.toISOString().split("T")[0],
      passed: record.passedQty >= record.inspectedQty * 0.95,
      ...record,
    };
    return {
      qualityRecords: [newRecord, ...state.qualityRecords],
      logs: [
        {
          id: `ACT-${Date.now()}`,
          who: "QA Lead",
          action: `Logged QC Inspection ${newRecord.id} with pass rate: ${((newRecord.passedQty / newRecord.inspectedQty) * 100).toFixed(1)}%`,
          when: new Date().toISOString(),
          kind: "quality",
        },
        ...state.logs,
      ],
    };
  }),

  addMaintenance: (task) => set((state) => {
    const newMaint = {
      id: `MNT-0${state.maintenance.length + 93}`,
      status: "SCHEDULED",
      ...task,
    };
    return {
      maintenance: [newMaint, ...state.maintenance],
      logs: [
        {
          id: `ACT-${Date.now()}`,
          who: "Current Operator",
          action: `Scheduled ${newMaint.type} Maintenance on ${newMaint.machineName}`,
          when: new Date().toISOString(),
          kind: "maintenance",
        },
        ...state.logs,
      ],
    };
  }),

  completeMaintenance: (id) => set((state) => {
    const item = state.maintenance.find(m => m.id === id);
    if (!item) return {};
    return {
      maintenance: state.maintenance.map((m) => (m.id === id ? { ...m, status: "COMPLETED", completedDate: NOW.toISOString().split("T")[0] } : m)),
      logs: [
        {
          id: `ACT-${Date.now()}`,
          who: "Current Operator",
          action: `Marked Maintenance task ${id} for ${item.machineName} as COMPLETED`,
          when: new Date().toISOString(),
          kind: "maintenance",
        },
        ...state.logs,
      ],
    };
  })
}));
