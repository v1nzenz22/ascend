// ESLint configuration (flat config format).
// Docs: https://eslint.org/docs/latest/use/configure/
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    // Generated or third-party code is never linted.
    ignores: [
      "node_modules/",
      "out/",
      "dist/",
      "dev-dist/",
      "coverage/",
      "test-results/",
      "playwright-report/",
    ],
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
    // The write boundary: only the data layer (src/db/) may touch the
    // database object. Everything else reads and writes through the
    // functions in src/db/*.ts, so every write passes src/db/write.ts.
    // Tests (tests/) may still use `db` directly to prepare data.
    files: ["src/**/*.ts"],
    ignores: [
      "src/db/**",
      // Temporary: main.ts still calls `db.open()`. It switches to
      // `openDatabase()` from src/db/lifecycle.ts in work package P2; then
      // this line goes.
      "src/main.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/db", "**/db/db.ts"],
              message:
                "Only src/db/ may use the database directly. Use the functions in src/db/*.ts (writes go through write.ts).",
            },
          ],
        },
      ],
    },
  },

  {
    // Plain JavaScript config files have no type information to check.
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
