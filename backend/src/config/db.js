import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

let prisma;

export function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return prisma;
}
