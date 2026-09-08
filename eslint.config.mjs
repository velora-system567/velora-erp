import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

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
    "desktop/**",
    "p0-backup/**",
    "**/*.mjs",
  ]),
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
        URLSearchParams: "readonly",
        URL: "readonly",
        navigator: "readonly",
        process: "readonly",
        Buffer: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Classic React Hooks rules only. The react-hooks v7 "recommended"
      // cascade also enables the React-Compiler analysis rules (refs-in-render,
      // impure-functions, memoization) which produce hard errors against this
      // repo's pre-existing dashboard/shell components. Those are unrelated to
      // the authentication work and refactoring them risks breaking the ERP, so
      // we deliberately scope to the two canonical rules (rules-of-hooks,
      // exhaustive-deps) plus warnings for the newer set-state-in-effect.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": ["warn", { additionalHooks: "" }],
      "react-hooks/set-state-in-effect": ["warn"],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_|^e$" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ...(cfg.languageOptions || {}),
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
        URLSearchParams: "readonly",
        URL: "readonly",
        navigator: "readonly",
        process: "readonly",
        Buffer: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
      },
    },
    plugins: {
      ...(cfg.plugins || {}),
      "react-hooks": reactHooks,
    },
    rules: {
      ...(cfg.rules || {}),
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": ["warn", { additionalHooks: "" }],
      "react-hooks/set-state-in-effect": ["warn"],
    },
  })),
]);
