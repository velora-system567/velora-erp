import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roleNames = [
  "OWNER",
  "ADMIN",
  "ACCOUNTANT",
  "SALES_MANAGER",
  "SALESMAN",
  "STORE_KEEPER",
  "PURCHASE_MANAGER",
  "PRODUCTION_OPERATOR",
  "HR_MANAGER",
];

const chartOfAccounts = [
  ["1000", "Cash", "ASSET"],
  ["1010", "Bank", "ASSET"],
  ["1100", "Debtors", "ASSET"],
  ["1200", "Input CGST", "ASSET"],
  ["1210", "Input SGST", "ASSET"],
  ["1220", "Input IGST", "ASSET"],
  ["2000", "Creditors", "LIABILITY"],
  ["2100", "Output CGST", "LIABILITY"],
  ["2110", "Output SGST", "LIABILITY"],
  ["2120", "Output IGST", "LIABILITY"],
  ["2200", "TDS Payable", "LIABILITY"],
  ["1300", "TDS Receivable", "ASSET"],
  ["3000", "Owner Equity", "EQUITY"],
  ["4000", "Sales", "INCOME"],
  ["5000", "Purchases", "EXPENSE"],
];

async function main() {
  console.log("Seed templates available", { roleNames, chartOfAccounts });
  console.log("Tenant-specific records are created during onboarding.");
}

main().finally(async () => {
  await prisma.$disconnect();
});
