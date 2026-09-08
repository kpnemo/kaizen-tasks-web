import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config([
  globalIgnores(["dist", ".mock", "src/api/types.ts", "src/components/ui"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
      prettier,
    ],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/features/*/**", "@/features/*/**"],
              message:
                "Features may not import from other features. Share through api/, lib/, or components/ui.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**", "src/main.tsx", "tests/**", "src/features/**/*.test.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // tests/render.tsx is a test helper, not a component module: it exports a query-client
    // factory and the renderApp() harness alongside a local <LocationProbe> used only inside it.
    files: ["tests/render.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["src/features/**"],
    ignores: ["src/features/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/features/*/**", "../*/**"],
              message:
                "Features may not import from other features. Share through api/, lib/, or components/ui.",
            },
          ],
        },
      ],
    },
  },
]);
