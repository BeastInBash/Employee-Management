import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // These files pair a component with non-component exports on purpose:
    // shadcn primitives export their variants, and each context exports its
    // Provider together with its useX hook. Fast refresh falls back to a full
    // reload when they change, which is fine for files edited this rarely.
    files: ["src/components/ui/**", "src/contexts/**", "src/components/theme-provider.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
