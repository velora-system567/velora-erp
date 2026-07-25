/**
 * Seed script: Populate the ERP with 100+ realistic records for testing.
 * Run: node src/seed-test-data.js
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}
const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 86400000);
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── Reference Data ──────────────────────────────────────────────
const CITIES = ["Mumbai", "Pune", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Ahmedabad", "Jaipur", "Lucknow", "Kolkata", "Nagpur", "Indore", "Bhopal", "Surat", "Nashik"];
const STATES = ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Telangana", "Gujarat", "Rajasthan", "Uttar Pradesh", "West Bengal", "Madhya Pradesh"];
const FIRST_NAMES = ["Rajesh", "Priya", "Amit", "Sneha", "Vikram", "Meera", "Suresh", "Kavita", "Rahul", "Pooja", "Deepak", "Anita", "Manoj", "Sunita", "Ajay", "Neha", "Ravi", "Geeta", "Sanjay", "Rekha", "Anil", "Sonia", "Ramesh", "Sapna", "Kiran", "Lata", "Vijay", "Archana", "Nitin", "Mamta", "Ganesh", "Komal", "Ashok", "Ritu", "Rajiv", "Pallavi", "Mohan", "Divya", "Sunil", "Nisha", "Mangesh", "Jyoti", "Vinod", "Snehal", "Prakash", "Shobha", "Sachin", "Asha", "Tushar", "Usha", "Dinesh", "Aarti", "Hemant", "Suman", "Yogesh", "Vandana", "Jayesh", "Leena", "Bharat", "Savita", "Girish", "Ujwala", "Mahesh", "Priti", "Chetan", "Meena", "Tarun", "Kavita", "Pankaj", "Damini"];
const LAST_NAMES = ["Patil", "Sharma", "Verma", "Gupta", "Reddy", "Singh", "Kumar", "Joshi", "Desai", "Iyer", "Nair", "Rao", "Kapoor", "Mehta", "Pandey", "Chauhan", "Tiwari", "Mishra", "Bhatt", "Thakur", "Malhotra", "Chowdhury", "Banerjee", "Mukherjee", "Ghosh", "Kulkarni", "Deshpande", "Pandit", "Jadhav", "More"];
const COMPANIES = ["Tata Steel", "Mahindra Auto", "Bajaj Auto", "L&T", "Godrej", "Reliance", "Infosys", "Wipro", "HCL Tech", "TCS", "Ashok Leyland", "Maruti Suzuki", "Hero Moto", "BHEL", "NTPC", "GAIL", "SAIL", "IOCL", "ONGC", "Hindustan Zinc", "Ultratech Cement", "JSW Steel", "Adani Power", "Tata Motors", "M&M", "TVS Motor", "Force Motors", "Eicher Motors", "Bosch India", "Siemens India", "ABB India", "Schneider Electric India"];
const ITEM_NAMES = ["Mild Steel Plate 10mm", "SS Pipe 304 2inch", "Copper Wire 2.5sqmm", "Aluminum Sheet 3mm", "Rubber Gasket 50mm", "Bearing 6205 2Z", "Hydraulic Hose 1/2 inch", "Pneumatic Fitting M12", "Welding Electrode E7018", "Cutting Disc 4.5 inch", "Bolt M10x50 Grade 8.8", "Nut M10 Hex", "Washer M10 Flat SS", "Teflon Tape 1/2 inch", "Gear Oil 90EP", "Compressor Oil ISO 68", "Coolant Concentrate", "Engine Oil 15W40 5L", "Grease Cartridge EP2", "Silicone Sealant Clear", "Thread Sealant PTFE", "Flange Joint Gasket", "Spring Washer M8", "Nylock Nut M8 SS", "Tee Joint 1/2 inch", "Elbow Joint 3/4 inch", "Quick Coupler 1/2 inch", "Flow Switch PN10", "Pressure Gauge 0-10bar", "Temperature Sensor PT100", "Proximity Sensor NPN", "Photoelectric Sensor", "Limit Switch Roller", "Safety Relay Module", "Timer Relay ON-Delay", "Contactor 3P 40A", "MCB 3P 32A", "MCB 2P 16A", "RCCB 4P 40A", "Busbar Copper 25x3", "Cable Gland PG11", "Cable Tie 200mm", "Heat Shrink Tube 3:1", "PVC Insulation Tape", "Cable Tray 200mm", "Conduit Pipe GI 25mm", "Junction Box IP65", "LED Panel Light 40W", "Emergency Light 3W", "Exit Sign LED", "Fire Extinguisher 5kg ABC", "Safety Helmet White", "Safety Shoe Size 9", "Ear Muff 28dB", "Safety Goggles Clear", "Chemical Gloves Size 9", "Dust Mask N95", "Hi-Vis Vest Orange"];
const UOM = ["NOS", "KGS", "MTR", "LTR", "SET", "PCS", "BOX", "BAG", "ROL", "SHT"];

async function main() {
  console.log("🚀 Seeding 100+ records for testing...\n");

  const passwordHash = await bcrypt.hash("Velora@123", 12);

  // ─── 1. Create Tenant & Company ──────────────────────────────
  const tenant = await prisma.tenant.create({
    data: { tenantId: crypto.randomUUID(), name: "Velora Manufacturing Pvt Ltd", slug: "velora-mfg" },
  });
  console.log("✅ Tenant created:", tenant.id);

  const company = await prisma.company.create({
    data: { tenantId: tenant.id, companyId: crypto.randomUUID(), name: "Velora Manufacturing Pvt Ltd", legalName: "Velora Manufacturing Private Limited", gstin: "27AABCV1234F1ZV" },
  });
  console.log("✅ Company created:", company.id);

  // ─── 2. Create Owner ─────────────────────────────────────────
  const owner = await prisma.user.create({
    data: { tenantId: tenant.id, companyId: company.id, name: "Jishan Tamboli", email: "jishan@velora.com", phone: "+919876543210", passwordHash, isActive: true, emailVerifiedAt: now },
  });

  const ownerRole = await prisma.role.create({ data: { tenantId: tenant.id, companyId: company.id, name: "OWNER", description: "Business owner" } });
  await prisma.userRole.create({ data: { tenantId: tenant.id, companyId: company.id, userId: owner.id, roleId: ownerRole.id } });
  console.log("✅ Owner created:", owner.email);

  // ─── 3. Create 10 Branches ───────────────────────────────────
  const branches = [];
  const branchNames = ["Head Office - Mumbai", "Factory - Pune", "Warehouse - Nashik", "Branch - Delhi", "Branch - Bangalore", "Branch - Chennai", "Branch - Hyderabad", "Branch - Ahmedabad", "Branch - Jaipur", "Branch - Kolkata"];
  for (let i = 0; i < branchNames.length; i++) {
    const branch = await prisma.branch.create({
      data: { tenantId: tenant.id, companyId: company.id, name: branchNames[i], code: `BR-${String(i + 1).padStart(3, "0")}`, address: { city: CITIES[i % CITIES.length], state: STATES[i % STATES.length] }, isActive: true },
    });
    branches.push(branch);
  }
  console.log(`✅ ${branches.length} branches created`);

  // ─── 4. Create 25 Employees (Users) ─────────────────────────
  const roleNames = ["ADMIN", "ACCOUNTANT", "SALES_MANAGER", "SALESMAN", "STORE_KEEPER", "PURCHASE_MANAGER", "PRODUCTION_OPERATOR", "HR_MANAGER"];
  const roles = [];
  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { tenantId_companyId_name: { tenantId: tenant.id, companyId: company.id, name } },
      update: {},
      create: { tenantId: tenant.id, companyId: company.id, name, description: `${name.replace(/_/g, " ").toLowerCase()} role` },
    });
    roles.push(role);
  }

  const employees = [owner];
  for (let i = 0; i < 24; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[i % LAST_NAMES.length];
    const emp = await prisma.user.create({
      data: { tenantId: tenant.id, companyId: company.id, branchId: branches[i % branches.length].id, name: `${fn} ${ln}`, email: `${fn.toLowerCase()}.${ln.toLowerCase()}@velora.com`, phone: `+91${rndInt(7000000000, 9999999999)}`, passwordHash, isActive: Math.random() > 0.1 },
    });
    const role = roles[i % roles.length];
    await prisma.userRole.create({ data: { tenantId: tenant.id, companyId: company.id, userId: emp.id, roleId: role.id } });
    employees.push(emp);
  }
  console.log(`✅ ${employees.length} employees created`);

  // ─── 5. Create 30 Items ──────────────────────────────────────
  const itemCategories = [];
  const catNames = ["Raw Materials", "Fasteners", "Electrical", "Safety Equipment", "Tools", "Consumables", "Lubricants", "Instruments"];
  for (const name of catNames) {
    const cat = await prisma.itemCategory.create({ data: { tenantId: tenant.id, companyId: company.id, name } });
    itemCategories.push(cat);
  }

  const uoms = [];
  for (const sym of UOM) {
    const uom = await prisma.unitOfMeasure.create({ data: { tenantId: tenant.id, companyId: company.id, name: sym === "NOS" ? "Numbers" : sym === "KGS" ? "Kilograms" : sym, symbol: sym } });
    uoms.push(uom);
  }

  const items = [];
  for (let i = 0; i < 30; i++) {
    const item = await prisma.item.create({
      data: {
        tenantId: tenant.id, companyId: company.id,
        itemCode: `ITM-${String(i + 1).padStart(4, "0")}`,
        name: ITEM_NAMES[i % ITEM_NAMES.length],
        description: `${ITEM_NAMES[i % ITEM_NAMES.length]} - high quality industrial supply`,
        itemType: pick(["RAW_MATERIAL", "FINISHED_GOOD", "CONSUMABLE"]),
        unitOfMeasureId: uoms[i % uoms.length].id,
        itemCategoryId: itemCategories[i % itemCategories.length].id,
        purchasePrice: rndInt(50, 15000),
        sellingPrice: rndInt(75, 20000),
        gstRate: pick([5, 12, 18, 28]),
        reorderLevel: rndInt(10, 100),
        reorderQuantity: rndInt(50, 500),
        barcode: `BAR${rndInt(100000000, 999999999)}`,
        brand: pick(["Tata", "Jindal", "L&T", "Havells", "Crompton", "Bosch", "Stanley", "3M", "Nitto", "Fenner"]),
        isActive: true,
      },
    });
    items.push(item);
  }
  console.log(`✅ ${items.length} items created`);

  // ─── 6. Create 30 Customers ──────────────────────────────────
  const customers = [];
  for (let i = 0; i < 30; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[i % LAST_NAMES.length];
    const city = CITIES[i % CITIES.length];
    const cust = await prisma.customer.create({
      data: {
        tenantId: tenant.id, companyId: company.id,
        name: i < COMPANIES.length ? COMPANIES[i] : `${COMPANIES[i % COMPANIES.length]} - ${city}`,
        gstin: `27${String.fromCharCode(65 + rndInt(0, 25))}${String.fromCharCode(65 + rndInt(0, 25))}${String.fromCharCode(65 + rndInt(0, 25))}${String.fromCharCode(65 + rndInt(0, 25))}${String.fromCharCode(65 + rndInt(0, 25))}${rndInt(1000, 9999)}${String.fromCharCode(65 + rndInt(0, 25))}Z${String.fromCharCode(65 + rndInt(0, 25))}${rndInt(0, 9)}`,
        billingAddress: { line1: `${rndInt(1, 500)}, ${pick(["MG Road", "Station Road", "Industrial Area", "Main Street", "Nehru Nagar", "Gandhi Road"])} `, city, state: pick(STATES), pincode: String(rndInt(110001, 999999)) },
        creditLimit: rndInt(50000, 500000),
        creditDays: pick([15, 30, 45, 60]),
        paymentTerms: pick(["Net 30", "Net 45", "Advance", "COD"]),
      },
    });
    customers.push(cust);
  }
  console.log(`✅ ${customers.length} customers created`);

  // ─── 7. Create 15 Vendors ────────────────────────────────────
  const vendorNames = ["Tata Steel Ltd", "Jindal Steel", "Havells India", "L&T Electricals", "Bosch India", "Siemens India", "ABB India", "3M India", "Fenner India", "Schneider Electric", "Crompton Greaves", "Polycab India", "Finolex Cables", "KEI Industries", "V-Guard Industries"];
  const vendors = [];
  for (let i = 0; i < 15; i++) {
    const vendor = await prisma.vendor.create({
      data: {
        tenantId: tenant.id, companyId: company.id,
        name: vendorNames[i],
        gstin: `27${String.fromCharCode(65 + rndInt(0, 25))}${String.fromCharCode(65 + rndInt(0, 25))}${String.fromCharCode(65 + rndInt(0, 25))}${String.fromCharCode(65 + rndInt(0, 25))}${String.fromCharCode(65 + rndInt(0, 25))}${rndInt(1000, 9999)}${String.fromCharCode(65 + rndInt(0, 25))}Z${String.fromCharCode(65 + rndInt(0, 25))}${rndInt(0, 9)}`,
        billingAddress: { city: pick(CITIES), state: pick(STATES) },
        creditLimit: rndInt(100000, 1000000),
        creditDays: pick([30, 45, 60]),
      },
    });
    vendors.push(vendor);
  }
  console.log(`✅ ${vendors.length} vendors created`);

  // ─── 8. Create 3 Warehouses ──────────────────────────────────
  const warehouses = [];
  const whNames = ["Main Warehouse - Pune", "Raw Material Store - Pune", "Finished Goods Store - Mumbai"];
  for (let i = 0; i < whNames.length; i++) {
    const wh = await prisma.warehouse.create({
      data: { tenantId: tenant.id, companyId: company.id, name: whNames[i], code: `WH-${String(i + 1).padStart(3, "0")}`, capacity: rndInt(5000, 20000), isDefault: i === 0, isActive: true },
    });
    warehouses.push(wh);
  }
  console.log(`✅ ${warehouses.length} warehouses created`);

  // ─── 9. Create 5 Leads ───────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    await prisma.lead.create({
      data: {
        tenantId: tenant.id, companyId: company.id,
        name: COMPANIES[20 + i],
        contactPerson: `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`,
        phone: `+91${rndInt(7000000000, 9999999999)}`,
        email: `lead${i + 1}@${COMPANIES[20 + i].toLowerCase().replace(/\s/g, "")}.com`,
        city: pick(CITIES),
        source: pick(["REFERENCE", "WEBSITE", "COLD_CALL", "EXHIBITION"]),
        priority: pick(["HIGH", "MEDIUM", "LOW"]),
        status: pick(["NEW", "NEW", "QUALIFIED"]),
        value: rndInt(50000, 5000000),
        requirement: `Industrial supplies for ${COMPANIES[20 + i]}`,
        nextFollowUp: daysAgo(-rndInt(1, 7)),
      },
    });
  }
  console.log("✅ 5 leads created");

  // ─── 10. Create Journal Entry accounts (Chart of Accounts) ───
  const accounts = [];
  const accountData = [
    { code: "1000", name: "Cash in Hand", type: "ASSET" },
    { code: "1100", name: "Bank Account", type: "ASSET" },
    { code: "1200", name: "Accounts Receivable", type: "ASSET" },
    { code: "1500", name: "Inventory", type: "ASSET" },
    { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
    { code: "2100", name: "GST Payable", type: "LIABILITY" },
    { code: "3000", name: "Owner's Equity", type: "EQUITY" },
    { code: "4000", name: "Sales Revenue", type: "INCOME" },
    { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" },
    { code: "6000", name: "Salary Expense", type: "EXPENSE" },
    { code: "6100", name: "Rent Expense", type: "EXPENSE" },
    { code: "6200", name: "Utilities Expense", type: "EXPENSE" },
  ];
  for (const a of accountData) {
    const acc = await prisma.chartOfAccount.create({
      data: { tenantId: tenant.id, companyId: company.id, ...a },
    });
    accounts.push(acc);
  }
  console.log(`✅ ${accounts.length} chart of accounts created`);

  // ─── 11. Create 3 Tax Rates ──────────────────────────────────
  const taxRates = [];
  for (const rate of [5, 12, 18]) {
    const tr = await prisma.taxRate.create({ data: { tenantId: tenant.id, companyId: company.id, name: `GST ${rate}%`, rate } });
    taxRates.push(tr);
  }
  console.log("✅ 3 tax rates created");

  // ─── 12. Create 10 Business Documents (Invoices, SOs, Quotations) ─
  const docTypes = ["QUOTATION", "SALES_ORDER", "DELIVERY_NOTE", "INVOICE"];
  const docNoPrefixes = ["QUO", "SO", "DN", "INV"];
  for (let i = 0; i < 10; i++) {
    const dtIdx = i % docTypes.length;
    const docType = docTypes[dtIdx];
    const subtotal = rndInt(5000, 200000);
    const cgst = Math.round(subtotal * 0.09);
    const sgst = Math.round(subtotal * 0.09);
    const doc = await prisma.businessDocument.create({
      data: {
        tenantId: tenant.id, companyId: company.id,
        documentType: docType,
        documentNo: `${docNoPrefixes[dtIdx]}/FY26-${String(i + 1).padStart(4, "0")}`,
        partyId: customers[i % customers.length].id,
        status: pick(["DRAFT", "SUBMITTED", "APPROVED", "APPROVED"]),
        documentDate: daysAgo(rndInt(1, 60)),
        subtotal, discount: rndInt(0, 1000), taxableAmount: subtotal - rndInt(0, 1000),
        cgstAmount: cgst, sgstAmount: sgst, igstAmount: 0,
        totalAmount: subtotal + cgst + sgst,
        terms: "Payment due within 30 days",
      },
    });

    // Add 2-4 lines per document
    const lineCount = rndInt(2, 4);
    const usedItems = pickN(items, lineCount);
    const lines = usedItems.map((item) => ({
      tenantId: tenant.id, companyId: company.id, documentId: doc.id,
      itemId: item.id, description: item.name,
      quantity: rndInt(1, 50), rate: item.sellingPrice,
      gstRate: item.gstRate, lineTotal: rndInt(1000, 100000),
    }));
    await prisma.businessDocumentLine.createMany({ data: lines });
  }
  console.log("✅ 10 business documents created (quotations, SOs, DNs, invoices)");

  // ─── 13. Create 5 Payments ───────────────────────────────────
  for (let i = 0; i < 5; i++) {
    await prisma.payment.create({
      data: {
        tenantId: tenant.id, companyId: company.id,
        paymentNumber: `REC/FY26-${String(i + 1).padStart(4, "0")}`,
        paymentType: "RECEIPT",
        partyId: customers[i % customers.length].id,
        partyType: "CUSTOMER",
        amount: rndInt(10000, 200000),
        mode: pick(["CASH", "NEFT", "UPI", "RTGS"]),
        paymentDate: daysAgo(rndInt(1, 30)),
      },
    });
  }
  console.log("✅ 5 payment receipts created");

  // ─── 14. Create 10 Leads (total 15) ──────────────────────────
  for (let i = 5; i < 15; i++) {
    await prisma.lead.create({
      data: {
        tenantId: tenant.id, companyId: company.id,
        name: COMPANIES[i % COMPANIES.length],
        contactPerson: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
        phone: `+91${rndInt(7000000000, 9999999999)}`,
        city: pick(CITIES),
        priority: pick(["HIGH", "MEDIUM", "LOW"]),
        status: pick(["NEW", "QUALIFIED", "LOST", "CONVERTED"]),
        value: rndInt(10000, 2000000),
      },
    });
  }
  console.log("✅ 15 leads total created");

  // ─── 15. Create 3 Machines (EAM) ─────────────────────────────
  const machineData = [
    { machineCode: "CNC-001", name: "CNC Lathe Machine", type: "CNC", location: "Factory Floor A", status: "RUNNING", utilizationPct: 78, healthScore: 92 },
    { machineCode: "PRESS-001", name: "Hydraulic Press 200T", type: "Hydraulic", location: "Factory Floor B", status: "IDLE", utilizationPct: 45, healthScore: 85 },
    { machineCode: "MILL-001", name: "Milling Machine VMC", type: "VMC", location: "Factory Floor A", status: "MAINTENANCE", utilizationPct: 62, healthScore: 70 },
  ];
  for (const m of machineData) {
    await prisma.machine.create({
      data: { ...m, tenantId: tenant.id, companyId: company.id, maintenanceDue: daysAgo(-rndInt(5, 30)) },
    });
  }
  console.log("✅ 3 machines created (EAM)");

  // ─── Summary ──────────────────────────────────────────────────
  console.log("\n🎉 Seed complete! Summary:");
  console.log(`   👤 Owner: jishan@velora.com / Velora@123`);
  console.log(`   🏢 Tenant: ${tenant.id}`);
  console.log(`   🏗️  Company: ${company.name}`);
  console.log(`   📍 Branches: ${branches.length}`);
  console.log(`   👥 Employees: ${employees.length}`);
  console.log(`   📦 Items: ${items.length}`);
  console.log(`   🤝 Customers: ${customers.length}`);
  console.log(`   🏭 Vendors: ${vendors.length}`);
  console.log(`   🏬 Warehouses: ${warehouses.length}`);
  console.log(`   📊 Leads: 15`);
  console.log(`   📄 Documents: 10 (quotations, SOs, DNs, invoices)`);
  console.log(`   💰 Payments: 5`);
  console.log(`   🏗️  Machines: 3`);
  console.log(`   📊 Accounts: ${accounts.length}`);
  console.log(`   💲 Tax Rates: ${taxRates.length}`);
  console.log(`\n   TOTAL RECORDS: ~${branches.length + employees.length + items.length + customers.length + vendors.length + warehouses.length + 15 + 10 + 5 + 3 + accounts.length + taxRates.length}`);
  console.log(`\n🌐 Open http://localhost:5173 and login with jishan@velora.com / Velora@123`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
