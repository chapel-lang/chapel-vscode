import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([globalIgnores(["**/out", "**/dist", "**/*.d.ts"]), {
  plugins: {
    "@typescript-eslint": typescriptEslint,
  },

  languageOptions: {
    parser: tsParser,
    ecmaVersion: 6,
    sourceType: "module",
  },

  settings: {
    maxWarnings: 0,
  },

  rules: {
    "@typescript-eslint/naming-convention": ["error", {
      selector: "import",
      format: ["camelCase", "PascalCase"],
    }],

    curly: "error",
    eqeqeq: "error",
    quotes: "error",
    "no-throw-literal": "error",
    semi: "error",
  },
}]);
