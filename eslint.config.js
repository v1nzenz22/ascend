// ESLint configuration (flat config format).
// Docs: https://eslint.org/docs/latest/use/configure/
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    // Generated or third-party code is never linted.
    ignores: ["node_modules/", "out/", "dist/", "test-results/", "playwright-report/"],
  },

  // Recommended rule sets: common JavaScript mistakes plus TypeScript rules
  // that use type information (e.g. catching a forgotten `await`).
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Config files in the repo root are not part of tsconfig "include".
          allowDefaultProject: ["*.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Security: never build code from strings.
      "no-eval": "error",
      "no-implied-eval": "off",
      "@typescript-eslint/no-implied-eval": "error",
      "no-new-func": "error",
    },
  },

  {
    // Plain JavaScript config files have no type information to check.
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
