const js = require("@eslint/js");
const eslintConfigPrettier = require("eslint-config-prettier");
const tseslint = require("typescript-eslint");
const pluginReactHooks = require("eslint-plugin-react-hooks");
const pluginReact = require("eslint-plugin-react");
const globals = require("globals");
const pluginNext = require("@next/eslint-plugin-next");
const baseConfig = require("./index.cjs");

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config}
 * */
module.exports = [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
    },
  },
  // Suppress TypeScript errors for React 19 component types 
  {
    rules: {
      // Disable TypeScript errors that occur with React 19
      "@typescript-eslint/no-explicit-any": "off",

      // Turn off JSX element type checking to allow Next.js and Lucide components
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",

      // Ignore errors for components like Link and Image
      "@typescript-eslint/ban-ts-comment": ["warn", {
        "ts-ignore": "allow-with-description",
        "minimumDescriptionLength": 10
      }],
    },
  },
];