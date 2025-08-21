import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

// Base configuration shared across all TypeScript files
const baseConfig = {
  languageOptions: {
    parser: tsparser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      project: "./tsconfig.json",
    },
    globals: {
      // Node.js globals
      console: "readonly",
      setTimeout: "readonly",
      clearTimeout: "readonly",
      setInterval: "readonly",
      clearInterval: "readonly",
      fetch: "readonly",
      process: "readonly",
      __dirname: "readonly",
      require: "readonly",
      NodeJS: "readonly",
      Buffer: "readonly",
      global: "readonly",
      performance: "readonly",
      // Jest globals (available everywhere for consistency)
      describe: "readonly",
      it: "readonly",
      test: "readonly",
      expect: "readonly",
      beforeEach: "readonly",
      afterEach: "readonly",
      beforeAll: "readonly",
      afterAll: "readonly",
      jest: "readonly",
      fail: "readonly",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint,
  },
  rules: {
    // TypeScript recommended rules
    ...tseslint.configs.recommended.rules,

    // Common rules for all TypeScript files
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/explicit-function-return-type": "off",
    "prefer-const": "error",
  },
};

export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts", "examples/**/*.ts"],
    ...baseConfig,
    rules: {
      ...baseConfig.rules,
      // Stricter rules for source code
      "@typescript-eslint/no-explicit-any": [
        "warn",
        {
          ignoreRestArgs: true,
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts"],
    ...baseConfig,
    rules: {
      ...baseConfig.rules,
      // More lenient for tests - allow any when testing invalid inputs
      "@typescript-eslint/no-explicit-any": [
        "warn",
        {
          ignoreRestArgs: true,
          fixToUnknown: false, // Don't auto-fix to unknown in tests
        },
      ],
      // Allow require() in tests for dynamic mocking
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "*.js"],
  },
];
