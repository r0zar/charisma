const js = require("@eslint/js");
const eslintConfigPrettier = require("eslint-config-prettier");
const turboPlugin = require("eslint-plugin-turbo");
const tseslint = require("typescript-eslint");
const onlyWarn = require("eslint-plugin-only-warn");
const unusedImports = require("eslint-plugin-unused-imports");

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
module.exports = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn"
    },
  },
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      // Auto-fixable unused import removal
      "unused-imports/no-unused-imports": "error",
      // Keep existing no-unused-vars but let unused-imports handle the auto-fixing
      "unused-imports/no-unused-vars": [
        "warn",
        {
          "vars": "all",
          "varsIgnorePattern": "^_",
          "args": "after-used", 
          "argsIgnorePattern": "^_",
        },
      ],
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**", "coverage/**", "**/*.lcov"],
  },
];