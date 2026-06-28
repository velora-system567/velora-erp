import { PrismaClient } from "@prisma/client";

let prisma;

export function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return prisma;
}
