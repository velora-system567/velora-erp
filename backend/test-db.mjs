import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const result = await prisma.$queryRaw`SELECT 1 as ok`;
  console.log("Connected OK:", result);
} catch (e) {
  console.error("Connection failed:", e.message);
} finally {
  await prisma.$disconnect();
}