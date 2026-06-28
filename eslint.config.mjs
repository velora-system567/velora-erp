import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    "**/node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "frontend/dist/**",
    "backend/dist/**",
    "next-env.d.ts",
  ]),
]);
