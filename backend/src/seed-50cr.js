/**
 * Comprehensive seed: ₹50 crore/year manufacturing company "Velora Engineering Pvt Ltd"
 *
 * Target volumes:
 *   60 employees, 8 branches, 300 items, 500 customers, 80 vendors,
 *   15 warehouses, 800 invoices, 600 sales orders, 500 POs, 400 GRNs,
 *   200 payments, 100 journal entries, 200 leads, 15 machines, stock data.
 *
 * Revenue model: ₹50Cr/year ≈ ₹4.17Cr/month ≈ ₹13.7L/day
 * Average invoice: ~₹50K–₹2L (industrial components, fasteners, electrical)
 *
 * Run: node src/seed-50cr.js
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rndFloat = (min, max) => +(min + Math.random() * (max - min)).toFixed(3);
const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 86400000);
const monthsAgo = (m) => new Date(now.getFullYear(), now.getMonth() - m, rnd(1, 28));

// ─── Reference Data ───────────────────────────────────────────────
const CITIES = ["Mumbai","Pune","Delhi","Bangalore","Chennai","Hyderabad","Ahmedabad","Jaipur","Lucknow","Kolkata","Nagpur","Indore","Bhopal","Surat","Nashik","Kolhapur","Satara","Aurangabad","Solapur","Nanded","Amravati","Jalna","Latur","Baroda","Rajkot","Morbi","Anand","Silvassa","Vapi","Daman"];
const STATES = ["Maharashtra","Delhi","Karnataka","Tamil Nadu","Telangana","Gujarat","Rajasthan","Uttar Pradesh","West Bengal","Madhya Pradesh","Goa","Chhattisgarh"];
const FIRST = ["Rajesh","Priya","Amit","Sneha","Vikram","Meera","Suresh","Kavita","Rahul","Pooja","Deepak","Anita","Manoj","Sunita","Ajay","Neha","Ravi","Geeta","Sanjay","Rekha","Anil","Sonia","Ramesh","Sapna","Kiran","Lata","Vijay","Archana","Nitin","Mamta","Ganesh","Komal","Ashok","Ritu","Rajiv","Pallavi","Mohan","Divya","Sunil","Nisha","Mangesh","Jyoti","Vinod","Snehal","Prakash","Shobha","Sachin","Asha","Tushar","Usha","Dinesh","Aarti","Hemant","Suman","Yogesh","Vandana","Jayesh","Leena","Bharat","Savita","Girish","Ujwala","Mahesh","Priti","Chetan","Meena","Tarun","Komal","Pankaj","Damini","Rajan","Shobha","Yash","Preeti"];
const LAST = ["Patil","Sharma","Verma","Gupta","Reddy","Singh","Kumar","Joshi","Desai","Iyer","Nair","Rao","Kapoor","Mehta","Pandey","Chauhan","Tiwari","Mishra","Bhatt","Thakur","Malhotra","Chowdhury","Banerjee","Mukherjee","Ghosh","Kulkarni","Deshpande","Pandit","Jadhav","More","Kulkarni","Deshpande","Sawant","Gawade","Salunkhe","Bhosale","Nalawade","Nile","Kale","Kokate"];

const COMPANY_SUFFIXES = ["Industries","Engineering","Manufacturing","Automotive","Precision","Systems","Technologies","Metal Works","Fabrication","Components","Traders","Corporation","Enterprises","Solutions","Pvt Ltd","Ltd","Corp","Manufacturers","Extrusions","Stampings"];
const FIRST_COMPANIES = ["Tata","Mahindra","Bajaj","L&T","Godrej","Reliance","Infosys","Wipro","HCL","TCS","Ashok Leyland","Maruti","Hero","BHEL","NTPC","GAIL","SAIL","IOCL","ONGC","Hindustan Zinc","Ultratech","JSW","Adani","Tata Motors","TVS","Force","Eicher","Bosch","Siemens","ABB","Schneider","Honeywell","Parker","Eaton","Danfoss","Emerson","ABB","Mitsubishi","Fanuc","Hyundai","Doosan","Haas","Okuma","DMG Mori","Trumpf","Amada","Bystronic","Mazak","Hurco","Fadal","HAAS"];

const ITEM_NAMES = [
  "Mild Steel Plate 10mm","Mild Steel Plate 6mm","Mild Steel Plate 12mm","MS Round Bar 20mm","MS Round Bar 25mm","MS Square Bar 16mm","MS Flat Bar 40x6mm",
  "SS Pipe 304 2inch","SS Pipe 304 1inch","SS Pipe 316 2inch","SS Sheet 304 1mm","SS Sheet 316 2mm","SS Rod 304 16mm","SS Angle 50x50x5",
  "Copper Wire 2.5sqmm","Copper Wire 4sqmm","Copper Pipe 15mm","Copper Sheet 1mm","Brass Rod 20mm","Brass Sheet 2mm",
  "Aluminum Sheet 3mm","Aluminum Round 25mm","Aluminum Channel 40x20","Aluminum Tube 20x1.5","Aluminum Plate 6mm",
  "Rubber Gasket 50mm","Rubber O-Ring 30mm","Rubber Sheet 3mm","Neoprene Gasket 80mm","Silicone Tube 10mm",
  "Bearing 6205 2Z","Bearing 6206 2Z","Bearing 6308 2RS","Bearing 6001 2Z","Bearing 6202 ZZ","Bearing NU206","Bearing 6310-2RS",
  "Hydraulic Hose 1/2 inch","Hydraulic Hose 3/4 inch","Hydraulic Hose 1inch","Hydraulic Fitting M16","Hydraulic Fitting M20","Hydraulic Filter Element",
  "Pneumatic Fitting M5","Pneumatic Fitting M8","Pneumatic Fitting M12","Pneumatic Cylinder 32mm","Pneumatic Cylinder 50mm","Air Regulator FR2000",
  "Welding Electrode E6013 3.15mm","Welding Electrode E7018 4mm","Welding Wire ER70S-6 1.2mm","Welding Flux SJ101","TIG Tungsten 2% 2.4mm",
  "Cutting Disc 4.5 inch","Cutting Disc 7 inch","Grinding Disc 4.5 inch","Flap Disc 4.5 inch","Wire Brush Wheel 4 inch",
  "Bolt M8x30 Grade 8.8","Bolt M10x40 Grade 8.8","Bolt M12x50 Grade 8.8","Bolt M16x60 Grade 10.9","Bolt M6x20 SS304",
  "Nut M8 Hex SS","Nut M10 Hex","Nut M12 Hex DIN934","Nut M16 Nylock","Nut M8 Nylock SS",
  "Washer M8 Flat SS","Washer M10 Flat","Washer M12 Spring","Washer M8 Nordlock","Washer M16 Flat",
  "Teflon Tape 1/2 inch","Teflon Tape 3/4 inch","PTFE Thread Sealant","Anaerobic Gasket Maker","Silicone Sealant Clear 300ml",
  "Gear Oil 90EP 20L","Compressor Oil ISO68 20L","Hydraulic Oil ISO46 20L","Engine Oil 15W40 5L","Grease EP2 Cartridge","Cutting Oil 20L","Way Oil 68 20L","Spindle Oil 22 20L",
  "LED Panel Light 40W","LED Batten 22W","LED Bulb 9W","Emergency Light 3W","Exit Sign LED","Flood Light 100W","Street Light 150W",
  "MCB 1P 10A","MCB 1P 16A","MCB 2P 32A","MCB 3P 63A","RCCB 2P 40A","RCCB 4P 63A","Isolator 3P 100A","Contactor LC1D09","Contactor LC1D25","Contactor LC1D40",
  "Relay Timer ON-Delay","Relay Timer OFF-Delay","Relay Timer Star-Delta","Safety Relay PNOZ","Emergency Stop Push Button","Selector Switch 2-Position",
  "Proximity Sensor NPN 8mm","Proximity Sensor PNP 12mm","Photoelectric Sensor diffuse","Photoelectric Sensor retro-reflective","Limit Switch Roller Lever","Pressure Switch 0-10bar","Temperature Switch PT100",
  "Pressure Gauge 0-10bar SS","Pressure Gauge 0-25bar","Temperature Gauge 0-200C","Flow Meter DN25","Flow Switch PN10","Level Sensor Ultrasonic",
  "PT100 RTD Sensor","Thermocouple Type K","Infrared Thermometer","Ultrasonic Thickness Gauge","Hardness Tester","Torque Wrench 50-250Nm",
  "Safety Helmet White","Safety Helmet Blue","Safety Shoe Size 9","Safety Shoe Size 10","Ear Muff 28dB","Ear Plug NRR33","Safety Goggles Clear","Safety Goggles Dark","Chemical Gloves Size 9","Heat Resistant Gloves","Hi-Vis Vest Orange","Hi-Vis Vest Yellow","Dust Mask N95","Half Face Respirator","Fall Protection Harness","Steel Toe Cap Insert",
  "Fire Extinguisher 5kg ABC","Fire Blanket 1.2x1.2m","First Aid Kit Industrial","Spill Kit 50L","Safety Sign Set","Barricade Tape 300m","Traffic Cone 750mm",
  "Cable Gland PG9","Cable Gland PG11","Cable Gland PG13.5","Cable Gland PG16","Cable Tie 200mm","Cable Tie 300mm","Heat Shrink Tube 3:1","PVC Insulation Tape Red","PVC Insulation Tape Blue","Cable Tray 200mm","Conduit Pipe GI 20mm","Conduit Pipe GI 25mm","Junction Box IP65","Panel Board 600x400"
];

const ITEM_CATEGORIES = ["Raw Materials","Fasteners & Fixings","Electrical","Safety Equipment","Tools & Consumables","Lubricants & Oils","Sensors & Instruments","Hydraulics & Pneumatics","Welding","Bearings & Power Transmission","Piping & Fittings","Lighting","Cable & Wiring","Sheet Metal & Profiles","Services"];
const UOM_DATA = [
  ["Numbers","NOS"],["Kilograms","KGS"],["Meters","MTR"],["Liters","LTR"],["Pieces","PCS"],["Box","BOX"],["Bag","BAG"],["Roll","ROL"],["Set","SET"],["Sheet","SHT"],["Lot","LOT"],["Pair","PR"],
];

async function main() {
  console.time("Total seed time");
  console.log("🚀 Seeding ₹50Cr/year manufacturing company data...\n");

  // ─── 0. Clean ─────────────────────────────────────────────────
  console.log("🧹 Cleaning existing data...");
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    // Delete in dependency order (child tables first)
    const models = [
      "refreshToken","businessDocumentLine","paymentAllocation","payment",
      "businessDocument","journalEntryLine","journalEntry","auditLog",
      "qualityCheck","workOrder","productionOrder","bomLine","bom",
      "maintenanceTask","machine","stockLedger","stockBatch","stockTransfer",
      "stockAdjustment","inventoryReservation","inventoryLocation","productSerial",
      "cycleCountLine","cycleCount","lead","userRole","userBranch","rolePermission",
      "permission","user","role","priceList","taxRate","chartOfAccount",
      "item","itemCategory","unitOfMeasure","customer","vendor","warehouse",
      "company","tenant","docNumberCounter",
    ];
    for (const m of models) {
      try { await prisma[m].deleteMany({ where: { tenantId: t.id } }); } catch {}
    }
    await prisma.tenant.delete({ where: { id: t.id } });
  }
  console.log("✅ Clean\n");

  // ─── 1. Tenant & Company ──────────────────────────────────────
  const tenant = await prisma.tenant.create({ data: { tenantId: crypto.randomUUID(), name: "Velora Engineering Pvt Ltd", slug: "velora-eng-50cr" } });
  const company = await prisma.company.create({
    data: { tenantId: tenant.id, companyId: crypto.randomUUID(), name: "Velora Engineering Pvt Ltd", legalName: "Velora Engineering Private Limited", gstin: "27AABCV1234F1ZV", panNumber: "AABCV1234F" },
  });
  console.log("✅ Tenant + Company");

  const TID = tenant.id, CID = company.id;
  const hash = await bcrypt.hash("Velora@123", 12);

  // ─── 2. Owner + Roles ─────────────────────────────────────────
  const owner = await prisma.user.create({ data: { tenantId: TID, companyId: CID, name: "Jishan Tamboli", email: "jishan@velora.com", phone: "+919876543210", passwordHash: hash, isActive: true, emailVerifiedAt: now } });
  const roleDefs = ["OWNER","ADMIN","ACCOUNTANT","SALES_MANAGER","SALESMAN","STORE_KEEPER","PURCHASE_MANAGER","PRODUCTION_OPERATOR","HR_MANAGER"];
  const roles = [];
  for (const name of roleDefs) {
    roles.push(await prisma.role.upsert({ where: { tenantId_companyId_name: { tenantId: TID, companyId: CID, name } }, update: {}, create: { tenantId: TID, companyId: CID, name } }));
  }
  await prisma.userRole.create({ data: { tenantId: TID, companyId: CID, userId: owner.id, roleId: roles[0].id } });

  // ─── 3. Branches (8) ──────────────────────────────────────────
  const branchDefs = ["Head Office - Pune","Factory Unit A - Pune","Factory Unit B - Pune","Warehouse Hub - Nashik","Branch - Mumbai","Branch - Delhi","Branch - Bangalore","Branch - Chennai"];
  const branches = [];
  for (let i = 0; i < branchDefs.length; i++) {
    branches.push(await prisma.branch.create({ data: { tenantId: TID, companyId: CID, name: branchDefs[i], code: `BR-${String(i+1).padStart(3,"0")}`, address: { city: CITIES[i], state: STATES[i % STATES.length] } } }));
  }

  // ─── 4. Employees (60) ────────────────────────────────────────
  const employees = [owner];
  for (let i = 0; i < 59; i++) {
    const fn = FIRST[i % FIRST.length], ln = LAST[i % LAST.length];
    const emp = await prisma.user.create({ data: { tenantId: TID, companyId: CID, branchId: branches[i % branches.length].id, name: `${fn} ${ln}`, email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@velora.com`, phone: `+91${rnd(7000000000,9999999999)}`, passwordHash: hash, isActive: Math.random() > 0.05 } });
    await prisma.userRole.create({ data: { tenantId: TID, companyId: CID, userId: emp.id, roleId: roles[i % roles.length].id } });
    employees.push(emp);
  }
  console.log(`✅ ${employees.length} employees`);

  // ─── 5. UoM + Categories ──────────────────────────────────────
  const uoms = [];
  for (const [name, sym] of UOM_DATA) { uoms.push(await prisma.unitOfMeasure.create({ data: { tenantId: TID, companyId: CID, name, symbol: sym } })); }
  const cats = [];
  for (const name of ITEM_CATEGORIES) { cats.push(await prisma.itemCategory.create({ data: { tenantId: TID, companyId: CID, name } })); }
  console.log(`✅ ${uoms.length} UoMs + ${cats.length} categories`);

  // ─── 6. Items (300) ───────────────────────────────────────────
  const brands = ["Tata","Jindal","L&T","Havells","Crompton","Bosch","Stanley","3M","Nitto","Fenner","Grundfos","Kirloskar","ISMT","SAIL","JSW","Essar","Minda","Motherson","Varroc","Sona","Bharat Forge","Amara Raja","Exide","Honeywell","Parker","Eaton","Danfoss","Emerson","Mitsubishi","Fanuc"];
  const items = [];
  for (let i = 0; i < 300; i++) {
    const basePrice = rnd(25, 50000);
    items.push(await prisma.item.create({
      data: { tenantId: TID, companyId: CID,
        itemCode: `ITM-${String(i+1).padStart(4,"0")}`,
        name: ITEM_NAMES[i % ITEM_NAMES.length] + (i >= ITEM_NAMES.length ? ` ${Math.floor(i / ITEM_NAMES.length) + 1}` : ""),
        description: `${ITEM_NAMES[i % ITEM_NAMES.length]} - industrial grade`,
        itemType: pick(["RAW_MATERIAL","FINISHED_GOOD","CONSUMABLE","SERVICE","SEMI_FINISHED"]),
        unitOfMeasureId: pick(uoms).id, itemCategoryId: pick(cats).id,
        purchasePrice: basePrice, sellingPrice: Math.round(basePrice * rnd(120, 180) / 100),
        gstRate: pick([5,12,18,28]), reorderLevel: rnd(5,200), reorderQuantity: rnd(20,500),
        barcode: i < 100 ? `BAR${rndInt(100000000,999999999)}` : null,
        brand: pick(brands), isActive: Math.random() > 0.05,
      }
    }));
  }
  console.log(`✅ ${items.length} items`);

  // ─── 7. Customers (500) ───────────────────────────────────────
  const customers = [];
  for (let i = 0; i < 500; i++) {
    const city = pick(CITIES);
    const state = pick(STATES);
    customers.push(await prisma.customer.create({
      data: { tenantId: TID, companyId: CID,
        name: i < FIRST_COMPANIES.length * COMPANY_SUFFIXES.length
          ? `${pick(FIRST_COMPANIES)} ${pick(COMPANY_SUFFIXES)} - ${city}`
          : `Customer ${i+1} - ${city}`,
        gstin: `27${String.fromCharCode(65+rnd(0,25))}${String.fromCharCode(65+rnd(0,25))}${String.fromCharCode(65+rnd(0,25))}${String.fromCharCode(65+rnd(0,25))}${String.fromCharCode(65+rnd(0,25))}${rnd(1000,9999)}${String.fromCharCode(65+rnd(0,25))}Z${String.fromCharCode(65+rnd(0,25))}${rnd(0,9)}`,
        billingAddress: { line1: `${rnd(1,999)}, ${pick(["MG Road","Station Road","Industrial Area","Main Street","GIDC","MIDC Phase 1","MIDC Phase 2","SEZ","Nagar Road","Pimpri Chinchwad","Hinjewadi","Wagholi","Kharadi","Bhumkar Nagar","Talawade"])} `, city, state, pincode: String(rnd(110001,999999)) },
        creditLimit: rnd(50000, 2000000), creditDays: pick([15,30,45,60]),
        paymentTerms: pick(["Net 30","Net 45","Advance 50%","COD","Net 60","100% Advance"]),
      }
    }));
  }
  console.log(`✅ ${customers.length} customers`);

  // ─── 8. Vendors (80) ──────────────────────────────────────────
  const vendorBase = ["Tata Steel","Jindal Steel","Havells India","L&T Electricals","Bosch India","Siemens India","ABB India","3M India","Fenner India","Schneider","Crompton","Polycab","Finolex","KEI Industries","V-Guard","Kirloskar","Grundfos","Danfoss","Parker Hannifin","Eaton Hydraulics","Norgren","SMC Pneumatics","Bimba","Festo","Schunk","Renishaw","Mitutoyo","Hexagon","Sandvik","Kennametal","Walter","Iscar","TaeguTec","OSG","OSG","Misumi","Thk","NSK","NTN","SKF","Timken","INA","FAG","Sealed Power","Mahle","Minda","Bharat Forge","Sona","Motherson","Varroc","Amara Raja","Exide","Tata AutoComp","Lucas TVS","Rane","Ceo","Minda Industries","Suprajit","Uno Minda","Minda","ZF","Continental","Bosch","Denso","Aisin","Jatco","Hyundai Mobis","Magna","YFAI","Faurecia","Lear","Adient","Brose","Kiekert","Brose","Motherson","Samvardhana","Minda","Sona","Bharat Forge"];
  const vendors = [];
  for (let i = 0; i < 80; i++) {
    vendors.push(await prisma.vendor.create({
      data: { tenantId: TID, companyId: CID, name: i < vendorBase.length ? `${vendorBase[i]} ${pick(COMPANY_SUFFIXES)}` : `Vendor ${i+1}`,
        gstin: `27${String.fromCharCode(65+rnd(0,25))}${String.fromCharCode(65+rnd(0,25))}${String.fromCharCode(65+rnd(0,25))}${String.fromCharCode(65+rnd(0,25))}${String.fromCharCode(65+rnd(0,25))}${rnd(1000,9999)}${String.fromCharCode(65+rnd(0,25))}Z${String.fromCharCode(65+rnd(0,25))}${rnd(0,9)}`,
        billingAddress: { city: pick(CITIES), state: pick(STATES) },
        creditLimit: rnd(100000, 5000000), creditDays: pick([30,45,60,90]),
      }
    }));
  }
  console.log(`✅ ${vendors.length} vendors`);

  // ─── 9. Warehouses (15) ───────────────────────────────────────
  const warehouses = [];
  const whTypes = ["WAREHOUSE","PRODUCTION","QUALITY","SCRAP","TRANSIT"];
  for (let i = 0; i < 15; i++) {
    warehouses.push(await prisma.warehouse.create({
      data: { tenantId: TID, companyId: CID, name: `Warehouse ${i+1} - ${pick(CITIES)}`, code: `WH-${String(i+1).padStart(3,"0")}`, warehouseType: pick(whTypes), capacity: rnd(1000,50000), isDefault: i === 0, isActive: true }
    }));
  }
  console.log(`✅ ${warehouses.length} warehouses`);

  // ─── 10. Chart of Accounts (30) ───────────────────────────────
  const accounts = [];
  const acctData = [
    ["1000","Cash in Hand","ASSET"],["1100","Bank Account - SBI","ASSET"],["1110","Bank Account - HDFC","ASSET"],
    ["1200","Accounts Receivable","ASSET"],["1210","Advance to Suppliers","ASSET"],["1300","Inventory - Raw Material","ASSET"],
    ["1310","Inventory - Finished Goods","ASSET"],["1400","Fixed Assets","ASSET"],["1500","GST Input Credit","ASSET"],
    ["2000","Accounts Payable","LIABILITY"],["2100","GST Output CGST","LIABILITY"],["2110","GST Output SGST","LIABILITY"],
    ["2120","GST Output IGST","LIABILITY"],["2200","TDS Payable","LIABILITY"],["2300","PF Payable","LIABILITY"],
    ["3000","Owner's Equity","EQUITY"],["3100","Retained Earnings","EQUITY"],["3200","Reserves","EQUITY"],
    ["4000","Sales Revenue - Domestic","INCOME"],["4100","Sales Revenue - Export","INCOME"],["4200","Other Income","INCOME"],
    ["4300","Discount Received","INCOME"],["5000","Cost of Goods Sold","EXPENSE"],["5100","Direct Labour","EXPENSE"],
    ["6000","Salary Expense","EXPENSE"],["6100","Rent Expense","EXPENSE"],["6200","Electricity","EXPENSE"],
    ["6300","Diesel & Fuel","EXPENSE"],["6400","Telephone & Internet","EXPENSE"],["6500","Repair & Maintenance","EXPENSE"],
  ];
  for (const [code,name,type] of acctData) { accounts.push(await prisma.chartOfAccount.create({ data: { tenantId: TID, companyId: CID, code, name, type } })); }
  console.log(`✅ ${accounts.length} chart of accounts`);

  // ─── 11. Tax Rates ────────────────────────────────────────────
  const taxRates = [];
  for (const rate of [5,12,18,28]) { taxRates.push(await prisma.taxRate.create({ data: { tenantId: TID, companyId: CID, name: `GST ${rate}%`, rate } })); }
  console.log("✅ 4 tax rates");

  // ─── 12. Leads (200) ──────────────────────────────────────────
  for (let i = 0; i < 200; i++) {
    await prisma.lead.create({ data: { tenantId: TID, companyId: CID,
      name: `${pick(FIRST_COMPANIES)} ${pick(COMPANY_SUFFIXES)} - ${pick(CITIES)}`,
      contactPerson: `${pick(FIRST)} ${pick(LAST)}`, phone: `+91${rnd(7000000000,9999999999)}`,
      email: `lead${i+1}@company.com`, city: pick(CITIES), source: pick(["REFERENCE","WEBSITE","COLD_CALL","EXHIBITION","SOCIAL_MEDIA","INDIA_MART","TRADE_INDIA"]),
      priority: pick(["HIGH","MEDIUM","LOW"]), status: pick(["NEW","NEW","QUALIFIED","QUALIFIED","LOST","CONVERTED"]),
      value: rnd(50000, 10000000), requirement: pick(["MS Components","SS Fabrication","Electrical Panels","Precision Parts","Hydraulic Cylinders","CNC Machining","Sheet Metal Work","Assembly Services"]),
    }});
  }
  console.log("✅ 200 leads");

  // ─── 13. Business Documents ───────────────────────────────────
  // Revenue target: ₹50Cr/year → ₹4.17Cr/month → ~₹1.39L/day
  // Average invoice: ~₹50K–₹2L (60 invoices/month ≈ ₹720 invoices/year)
  // We'll create ~800 invoices, 600 SOs, 500 quotations, 400 DNs across 12 months

  let totalRevenue = 0;
  let docCounts = { QUOTATION: 0, SALES_ORDER: 0, DELIVERY_NOTE: 0, INVOICE: 0 };

  const docTypes = ["QUOTATION","SALES_ORDER","DELIVERY_NOTE","INVOICE"];
  const prefixes = { QUOTATION: "QUO", SALES_ORDER: "SO", DELIVERY_NOTE: "DN", INVOICE: "INV" };
  const counts = { QUOTATION: 500, SALES_ORDER: 600, DELIVERY_NOTE: 400, INVOICE: 800 };
  const statuses = { QUOTATION: ["DRAFT","SUBMITTED","APPROVED","REJECTED","CANCELLED"], SALES_ORDER: ["DRAFT","SUBMITTED","APPROVED","CLOSED","CANCELLED"], DELIVERY_NOTE: ["DRAFT","SUBMITTED","APPROVED"], INVOICE: ["DRAFT","SUBMITTED","APPROVED","CLOSED","CANCELLED"] };

  // Batch insert for performance
  const docBatch = [];
  const lineBatch = [];

  for (const docType of docTypes) {
    for (let i = 0; i < counts[docType]; i++) {
      const monthOffset = rnd(0, 11);
      const subtotal = docType === "INVOICE" ? rnd(30000, 250000) : rnd(20000, 200000);
      const cgst = Math.round(subtotal * 0.09);
      const sgst = Math.round(subtotal * 0.09);
      const doc = {
        tenantId: TID, companyId: CID,
        documentType: docType,
        documentNo: `${prefixes[docType]}/FY26-${String(i+1).padStart(5,"0")}`,
        partyId: pick(customers).id, status: pick(statuses[docType]),
        documentDate: monthsAgo(monthOffset), subtotal, discount: rnd(0, Math.min(5000, subtotal / 10)),
        taxableAmount: subtotal, cgstAmount: cgst, sgstAmount: sgst, igstAmount: 0,
        totalAmount: subtotal + cgst + sgst, terms: "Net 30 days",
      };
      docBatch.push(doc);
      docCounts[docType]++;

      // 2-5 lines per doc
      const lineCount = rnd(2, 5);
      const usedItems = pickN(items, lineCount);
      for (const item of usedItems) {
        const qty = rnd(1, 100);
        const rate = item.sellingPrice;
        lineBatch.push({
          tenantId: TID, companyId: CID, documentId: null, // will fix after
          itemId: item.id, description: item.name, quantity: qty,
          rate, gstRate: item.gstRate, lineTotal: qty * rate,
        });
      }

      if (docType === "INVOICE") totalRevenue += subtotal + cgst + sgst;
    }
  }

  // Insert documents in batches
  const docIds = [];
  for (let i = 0; i < docBatch.length; i += 500) {
    const batch = docBatch.slice(i, i + 500);
    const created = await prisma.businessDocument.createMany({ data: batch });
    // Fetch back IDs
    const docs = await prisma.businessDocument.findMany({ where: { tenantId: TID, companyId: CID }, select: { id: true }, orderBy: { createdAt: "asc" } });
    docIds.length = 0;
    docIds.push(...docs.map(d => d.id));
  }

  // Fix lineBatch documentIds (distribute evenly)
  for (let i = 0; i < lineBatch.length; i++) {
    lineBatch[i].documentId = docIds[i % docIds.length];
  }
  for (let i = 0; i < lineBatch.length; i += 1000) {
    await prisma.businessDocumentLine.createMany({ data: lineBatch.slice(i, i + 1000) });
  }

  console.log(`✅ Documents: ${docCounts.QUOTATION} quotations, ${docCounts.SALES_ORDER} SOs, ${docCounts.DELIVERY_NOTE} DNs, ${docCounts.INVOICE} invoices`);
  console.log(`   Total revenue seeded: ₹${(totalRevenue / 10000000).toFixed(2)} Cr`);

  // ─── 14. Payments (500) ───────────────────────────────────────
  const payBatch = [];
  for (let i = 0; i < 500; i++) {
    payBatch.push({
      tenantId: TID, companyId: CID,
      paymentNumber: `REC/FY26-${String(i+1).padStart(5,"0")}`,
      paymentType: pick(["RECEIPT","RECEIPT","RECEIPT","PAYMENT"]),
      partyId: pick(payBatch.length < 300 ? customers : vendors).id,
      partyType: pick(["CUSTOMER","CUSTOMER","VENDOR"]),
      amount: rnd(10000, 300000), mode: pick(["CASH","NEFT","RTGS","UPI","CHEQUE","CARD"]),
      paymentDate: monthsAgo(rnd(0, 11)),
    });
  }
  await prisma.payment.createMany({ data: payBatch });
  console.log(`✅ ${payBatch.length} payments`);

  // ─── 15. Journal Entries (100) — batched ──────────────────────
  const jeBatch = [];
  const jeLineBatch = [];
  for (let i = 0; i < 100; i++) {
    jeBatch.push({
      tenantId: TID, companyId: CID, entryNo: `JE/FY26-${String(i+1).padStart(4,"0")}`, entryDate: monthsAgo(rnd(0,11)),
      narration: pick(["Sales invoice posting","Purchase invoice posting","Salary payment","Rent payment","Bank charges","Interest income","Depreciation","GST payment","TDS adjustment","Stock adjustment","Discount allowed","Bad debt write-off"]),
    });
  }
  await prisma.journalEntry.createMany({ data: jeBatch });
  const jeIds = await prisma.journalEntry.findMany({ where: { tenantId: TID }, select: { id: true }, orderBy: { createdAt: "asc" } });
  for (let i = 0; i < jeIds.length; i++) {
    const lineCount = rnd(2, 4);
    const usedAccts = pickN(accounts, lineCount);
    const amount = rnd(5000, 500000);
    usedAccts.forEach((a, idx) => {
      jeLineBatch.push({
        tenantId: TID, companyId: CID, journalEntryId: jeIds[i].id, accountId: a.id,
        debit: idx === 0 ? amount : 0, credit: idx === 0 ? 0 : Math.round(amount / (lineCount - 1)),
      });
    });
  }
  await prisma.journalEntryLine.createMany({ data: jeLineBatch });
  console.log("✅ 100 journal entries");

  // ─── 16. Purchase Requests (100) + RFQs (60) — batched ─────────
  const prBatch = [];
  for (let i = 0; i < 100; i++) {
    prBatch.push({ tenantId: TID, companyId: CID, prNumber: `PR/FY26-${String(i+1).padStart(4,"0")}`, status: pick(["DRAFT","SUBMITTED","APPROVED","REJECTED","CONVERTED"]), notes: pick(["Urgent production requirement","Monthly stock replenishment","New project material","Reorder level triggered","Customer order specific"]) });
  }
  await prisma.purchaseRequest.createMany({ data: prBatch });
  const prIds = await prisma.purchaseRequest.findMany({ where: { tenantId: TID }, select: { id: true }, orderBy: { createdAt: "asc" } });
  const prLineBatch = [];
  for (const pr of prIds) {
    for (const item of pickN(items, rnd(2, 5))) {
      prLineBatch.push({ tenantId: TID, companyId: CID, purchaseRequestId: pr.id, itemId: item.id, quantity: rndFloat(10, 500), estimatedRate: item.purchasePrice });
    }
  }
  await prisma.purchaseRequestLine.createMany({ data: prLineBatch });

  await prisma.rfq.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ tenantId: TID, companyId: CID, rfqNumber: `RFQ/FY26-${String(i+1).padStart(4,"0")}`, vendorId: pick(vendors).id, status: pick(["DRAFT","SENT","RECEIVED","COMPARED","CLOSED"]), notes: "Request for quotation" })) });
  console.log("✅ 100 purchase requests + 60 RFQs");

  // ─── 17. GRNs (300) — batched ─────────────────────────────────
  const grnBatch = [];
  for (let i = 0; i < 300; i++) {
    grnBatch.push({ tenantId: TID, companyId: CID, grnNumber: `GRN/FY26-${String(i+1).padStart(4,"0")}`, vendorId: pick(vendors).id, warehouseId: pick(warehouses).id, status: pick(["DRAFT","INSPECTED","APPROVED","REJECTED"]), receiptDate: monthsAgo(rnd(0,11)) });
  }
  await prisma.goodsReceiptNote.createMany({ data: grnBatch });
  const grnIds = await prisma.goodsReceiptNote.findMany({ where: { tenantId: TID }, select: { id: true }, orderBy: { createdAt: "asc" } });
  const grnLineBatch = [];
  for (const grn of grnIds) {
    for (const item of pickN(items, rnd(1, 4))) {
      grnLineBatch.push({ tenantId: TID, companyId: CID, grnId: grn.id, itemId: item.id, orderedQty: rndFloat(10, 200), receivedQty: rndFloat(10, 200), acceptedQty: rndFloat(5, 200), rate: item.purchasePrice, gstRate: item.gstRate, lineTotal: rnd(5000, 100000) });
    }
  }
  await prisma.goodsReceiptLine.createMany({ data: grnLineBatch });
  console.log("✅ 300 GRNs");

  // ─── 18. Production Orders (100) + Work Orders (200) + QC (80) ──
  const poBatch = [];
  for (let i = 0; i < 100; i++) {
    poBatch.push({ tenantId: TID, companyId: CID, poNumber: `PO/FY26-${String(i+1).padStart(4,"0")}`, itemId: pick(items).id, quantity: rndFloat(10, 500), status: pick(["DRAFT","PLANNED","IN_PROGRESS","COMPLETED","CANCELLED"]), priority: pick(["HIGH","MEDIUM","LOW"]), progress: rnd(0,100) });
  }
  await prisma.productionOrder.createMany({ data: poBatch });
  const poIds = await prisma.productionOrder.findMany({ where: { tenantId: TID }, select: { id: true }, orderBy: { createdAt: "asc" } });

  const woBatch = [];
  let woIdx = 0;
  for (const po of poIds) {
    for (let j = 0; j < rnd(1, 3); j++) {
      woBatch.push({ tenantId: TID, companyId: CID, productionOrderId: po.id, woNumber: `WO/FY26-${String(++woIdx).padStart(4,"0")}`, operationName: pick(["Cutting","Machining","Welding","Assembly","Painting","Heat Treatment","Grinding","Deburring","Inspection","Packaging"]), plannedQty: rndFloat(10, 200), completedQty: rndFloat(0, 200), status: pick(["PENDING","IN_PROGRESS","COMPLETED","ON_HOLD"]) });
    }
  }
  await prisma.workOrder.createMany({ data: woBatch });
  const woIds = await prisma.workOrder.findMany({ where: { tenantId: TID }, select: { id: true }, orderBy: { createdAt: "asc" } });

  const qcBatch = [];
  let qcIdx = 0;
  for (const wo of woIds) {
    if (Math.random() > 0.6) {
      qcBatch.push({ tenantId: TID, companyId: CID, workOrderId: wo.id, qcNumber: `QC/FY26-${String(++qcIdx).padStart(4,"0")}`, inspectedQty: rndFloat(5, 100), passedQty: rndFloat(3, 100), failedQty: rndFloat(0, 10), result: pick(["PASS","PASS","PASS","FAIL","REWORK"]), inspector: pick(employees).name });
    }
  }
  await prisma.qualityCheck.createMany({ data: qcBatch });
  console.log(`✅ ${poBatch.length} POs + ${woBatch.length} WOs + ${qcBatch.length} QC`);

  // ─── 19. BOMs (50) — small batches to avoid timeout ──────────
  for (let i = 0; i < 50; i++) {
    const bom = await prisma.bom.create({ data: { tenantId: TID, companyId: CID, itemId: items[i].id, version: `v1.${rnd(0,5)}`, isDefault: i < 10 } });
    const row = pickN(items, rnd(3, 8)).map((item) => ({ tenantId: TID, bomId: bom.id, componentId: item.id, quantity: rndFloat(1, 50), scrapPercent: rnd(0, 15) }));
    await prisma.bomLine.createMany({ data: row });
  }
  console.log("✅ 50 BOMs");

  // ─── 20. Machines (15) + Maintenance (60) ─────────────────────
  const machineDefs = [
    ["CNC-001","CNC Lathe - DMG Mori","CNC","Factory Floor A",78,92],["CNC-002","CNC Lathe - Mazak","CNC","Factory Floor A",65,88],
    ["VMC-001","VMC Machining Center","VMC","Factory Floor B",72,90],["VMC-002","VMC - Haas VF2","VMC","Factory Floor B",58,85],
    ["PRESS-001","Hydraulic Press 200T","Press","Factory Floor C",82,78],["PRESS-002","Mechanical Press 100T","Press","Factory Floor C",70,82],
    ["WELD-001","TIG Welding Station","Welding","Fab Shop",45,95],["WELD-002","MIG Welding Robot","Welding","Fab Shop",60,88],
    ["GRIND-001","Surface Grinder","Grinding","Machine Shop",55,80],["GRIND-002","Cylindrical Grinder","Grinding","Machine Shop",48,75],
    ["CUT-001","Plasma Cutter","Cutting","Fab Shop",72,90],["CUT-002","Waterjet Cutter","Cutting","Fab Shop",68,85],
    ["DRILL-001","Radial Drill","Drilling","Machine Shop",40,92],["PAINT-001","Powder Coating Line","Painting","Paint Shop",55,88],
    ["LOAD-001","Overhead Crane 10T","Material Handling","Warehouse",85,95],
  ];
  const machines = [];
  for (const [code,name,type,loc,util,health] of machineDefs) {
    machines.push(await prisma.machine.create({ data: { tenantId: TID, companyId: CID, machineCode: code, name, type, location: loc, status: pick(["RUNNING","RUNNING","IDLE","MAINTENANCE"]), utilizationPct: util, healthScore: health, maintenanceDue: daysAgo(-rnd(5,90)) } }));
  }
  await prisma.maintenanceTask.createMany({ data: Array.from({ length: 60 }, (_, i) => ({
    tenantId: TID, companyId: CID, machineId: pick(machines).id, taskNumber: `MT/FY26-${String(i+1).padStart(4,"0")}`,
    taskType: pick(["Preventive","Corrective","Predictive","Emergency","Calibration"]),
    description: pick(["Routine inspection","Bearing replacement","Oil change","Alignment check","Spare part replacement","Cleaning & lubrication","Sensor calibration","Electrical inspection","Hydraulic system check","Coolant replacement"]),
    scheduledDate: daysAgo(-rnd(1,60)), status: pick(["SCHEDULED","IN_PROGRESS","COMPLETED","COMPLETED"]), costPaise: rnd(500, 50000),
  })) });
  console.log("✅ 15 machines + 60 maintenance tasks");

  // ─── 21. Stock Ledger (500 entries) ───────────────────────────
  const ledgerBatch = [];
  for (let i = 0; i < 500; i++) {
    ledgerBatch.push({
      tenantId: TID, companyId: CID, itemId: pick(items).id, warehouseId: pick(warehouses).id,
      transactionType: pick(["PURCHASE","SALE","TRANSFER_IN","TRANSFER_OUT","ADJUSTMENT","OPENING","PRODUCTION_IN","PRODUCTION_OUT"]),
      quantity: rndFloat(1, 500), rate: rnd(25, 10000), value: rnd(1000, 500000),
    });
  }
  for (let i = 0; i < ledgerBatch.length; i += 500) {
    await prisma.stockLedger.createMany({ data: ledgerBatch.slice(i, i + 500) });
  }
  console.log("✅ 2000 stock ledger entries");

  // ─── 22. Stock Batches (500) ──────────────────────────────────
  const batchData = [];
  for (let i = 0; i < 500; i++) {
    batchData.push({
      tenantId: TID, companyId: CID, itemId: pick(items).id, warehouseId: pick(warehouses).id,
      batchNumber: `BAT-${String(i+1).padStart(5,"0")}`, costRate: rnd(25, 10000),
      qtyIn: rndFloat(10, 500), qtyRemaining: rndFloat(0, 500),
      receivedDate: monthsAgo(rnd(0, 11)),
    });
  }
  await prisma.stockBatch.createMany({ data: batchData });
  console.log("✅ 500 stock batches");

  // ─── 23. Stock Transfers (100) ────────────────────────────────
  for (let i = 0; i < 100; i++) {
    const fromWh = pick(warehouses), toWh = pick(warehouses.filter(w => w.id !== fromWh.id)) || warehouses[0];
    await prisma.stockTransfer.create({ data: { tenantId: TID, companyId: CID, itemId: pick(items).id, fromWarehouseId: fromWh.id, toWarehouseId: toWh.id, quantity: rndFloat(10, 200), status: pick(["DRAFT","SUBMITTED","APPROVED","REJECTED","CLOSED"]) } });
  }
  console.log("✅ 100 stock transfers");

  // ─── Summary ──────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("🎉 SEED COMPLETE — ₹50 Cr/yr Manufacturing Company");
  console.log("═".repeat(60));
  console.log(`🏢 Company: Velora Engineering Pvt Ltd`);
  console.log(`👤 Login: jishan@velora.com / Velora@123`);
  console.log("");
  console.log(`📊 Data volumes:`);
  console.log(`   👤 Employees:        ${employees.length}`);
  console.log(`   📍 Branches:         ${branches.length}`);
  console.log(`   📦 Items:            ${items.length}`);
  console.log(`   🤝 Customers:        ${customers.length}`);
  console.log(`   🏭 Vendors:          ${vendors.length}`);
  console.log(`   🏬 Warehouses:       ${warehouses.length}`);
  console.log(`   📊 Leads:            200`);
  console.log(`   📄 Quotations:       500`);
  console.log(`   🛒 Sales Orders:     600`);
  console.log(`   📋 Delivery Notes:   400`);
  console.log(`   📄 Invoices:         800`);
  console.log(`   💰 Payments:         500`);
  console.log(`   📋 Journal Entries:  100`);
  console.log(`   📦 Purchase Req:     100`);
  console.log(`   📋 RFQs:             60`);
  console.log(`   📥 GRNs:             300`);
  console.log(`   🏭 Production:       100 PO + 200 WO + 80 QC`);
  console.log(`   📐 BOMs:             50`);
  console.log(`   🏭 Machines:         15 + 60 maintenance`);
  console.log(`   📊 Stock Ledger:     2000 entries`);
  console.log(`   📦 Stock Batches:    500`);
  console.log(`   🔄 Transfers:        100`);
  console.log(`   📊 Accounts:         ${accounts.length}`);
  console.log(`   💲 Tax Rates:        ${taxRates.length}`);
  console.log(`   📊 Total Records:    ~7,500+`);
  console.log("");
  console.log(`🌐 Open http://localhost:5173`);
  console.timeEnd("Total seed time");
}

function rndInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

main()
  .catch((e) => { console.error("❌ Seed failed:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
