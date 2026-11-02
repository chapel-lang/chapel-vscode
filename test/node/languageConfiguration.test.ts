import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as jsonc from "jsonc-parser";

const repoRoot = path.resolve(__dirname, "..", "..", "..");

describe("language configurations", () => {
  for (const file of [
    "chapel-language-configuration.json",
    "chapel-ast-language-configuration.json",
  ]) {
    it(`${file} parses and defines comments and brackets`, () => {
      const errors: jsonc.ParseError[] = [];
      // VS Code reads language configurations as JSONC with trailing commas allowed
      const config = jsonc.parse(
        fs.readFileSync(path.join(repoRoot, file), "utf8"),
        errors,
        { allowTrailingComma: true }
      );
      assert.deepStrictEqual(
        errors.map((e) => jsonc.printParseErrorCode(e.error)),
        []
      );
      assert.ok(config.comments, "missing comments");
      assert.ok(Array.isArray(config.brackets), "missing brackets");
    });
  }
});
