import nextConfig from "@repo/eslint-config/next";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import importPlugin from "eslint-plugin-import";

export default [
  ...nextConfig,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "import": importPlugin,
    },
    rules: {
      // Auto-fixable import sorting
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      
      // Auto-fixable import organization
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      
      // Auto-fixable TypeScript/JavaScript fixes
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "vars": "all",
          "varsIgnorePattern": "^_",
          "args": "after-used",
          "argsIgnorePattern": "^_",
        },
      ],
      
      // Auto-fixable code style
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "prefer-arrow-callback": "error",
      
      // Auto-fixable React fixes
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-curly-brace-presence": ["error", { "props": "never", "children": "never" }],
      "react/self-closing-comp": "error",
    },
  },
];