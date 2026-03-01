import typescriptEslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";

export default [
  // ── Global ignores ──────────────────────────────────────────────────────────
  {
    ignores: ["**/out/**", "**/node_modules/**", "scripts/**"],
  },

  // ── TypeScript source + webview files ───────────────────────────────────────
  {
    files: [
      "packages/*/src/**/*.ts",
      "packages/*/views/**/*.{ts,tsx}",
      "packages/shared-views/**/*.{ts,tsx}",
    ],
    plugins: {
      "@typescript-eslint": typescriptEslint.plugin,
    },
    languageOptions: {
      parser: typescriptEslint.parser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        jsx: true,
      },
    },
    rules: {
      // ── Naming ──
      "@typescript-eslint/naming-convention": ["warn", {
        selector: "import",
        format: ["camelCase", "PascalCase"],
      }],

      // ── TypeScript quality ──
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrors: "none",
      }],
      "@typescript-eslint/consistent-type-imports": ["warn", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      }],
      "@typescript-eslint/no-non-null-assertion": "warn",

      // ── Base rules ──
      "no-unused-vars": "off",        // replaced by @typescript-eslint/no-unused-vars
      "prefer-const": "error",
      "no-console": "warn",
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      semi: "warn",
    },
  },

  // ── React webview files ─────────────────────────────────────────────────────
  {
    files: [
      "packages/*/views/**/*.{ts,tsx}",
      "packages/shared-views/**/*.{ts,tsx}",
    ],
    plugins: {
      "react-hooks": reactHooks,
      "react": reactPlugin,
    },
    settings: {
      react: { version: "19" },
    },
    rules: {
      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // JSX quality
      "react/jsx-key": "error",
      "react/self-closing-comp": "warn",
      "react/jsx-no-duplicate-props": "error",
      "react/no-danger": "warn",
    },
  },
];
