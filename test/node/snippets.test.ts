import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as jsonc from "jsonc-parser";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const snippetsText = fs.readFileSync(
  path.join(repoRoot, "snippets", "chapel.json"),
  "utf8"
);

function isNonEmptyStringOrList(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === "string")
  );
}

describe("snippets/chapel.json", () => {
  it("is valid JSON", () => {
    assert.doesNotThrow(() => JSON.parse(snippetsText));
  });

  it("has no duplicate snippet names", () => {
    const errors: jsonc.ParseError[] = [];
    const tree = jsonc.parseTree(snippetsText, errors);
    assert.deepStrictEqual(errors, []);
    assert.ok(tree);
    const names = (tree.children ?? []).map((p) => p.children![0].value);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepStrictEqual(duplicates, []);
  });

  describe("snippet fields", () => {
    const snippets: Record<string, Record<string, unknown>> =
      JSON.parse(snippetsText);

    it("every snippet has a non-empty prefix and body", () => {
      assert.ok(Object.keys(snippets).length > 0);
      const incomplete = Object.entries(snippets)
        .filter(
          ([, s]) =>
            !isNonEmptyStringOrList(s.prefix) || !isNonEmptyStringOrList(s.body)
        )
        .map(([name]) => name);
      assert.deepStrictEqual(incomplete, []);
    });

    it.skip("every snippet has a non-empty description (#156)", () => {
      const undescribed = Object.entries(snippets)
        .filter(
          ([, s]) =>
            typeof s.description !== "string" ||
            s.description.trim().length === 0
        )
        .map(([name]) => name);
      assert.deepStrictEqual(undescribed, []);
    });
  });
});
