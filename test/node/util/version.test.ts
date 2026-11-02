import * as assert from "assert";
import { meetsMinVersion, parseToolVersion } from "../../../src/util/version";

describe("util/version", () => {
  describe("parseToolVersion", () => {
    it("parses chpl --version output", () => {
      assert.strictEqual(
        parseToolVersion("chpl version 2.10.0 pre-release (abc123)"),
        "2.10.0"
      );
    });

    it("parses chpl-language-server --version output", () => {
      assert.strictEqual(parseToolVersion("chpl-language-server 2.9.0"), "2.9.0");
    });

    it("parses multi-line output", () => {
      assert.strictEqual(
        parseToolVersion("chpl version 2.4.0\n  built with LLVM version 19.1.7\nCopyright 2020-2025"),
        "2.4.0"
      );
    });

    it("returns undefined for output without a version", () => {
      assert.strictEqual(parseToolVersion("command not found: chpl"), undefined);
      assert.strictEqual(parseToolVersion(""), undefined);
    });
  });

  describe("meetsMinVersion", () => {
    it("accepts an equal version", () => {
      assert.ok(meetsMinVersion("2.9.0", "2.9.0"));
    });

    it("compares numerically, not lexicographically", () => {
      assert.ok(meetsMinVersion("2.10.0", "2.9.0"));
      assert.ok(!meetsMinVersion("2.9.0", "2.10.0"));
    });

    it("compares each component in order", () => {
      assert.ok(meetsMinVersion("3.0.0", "2.99.99"));
      assert.ok(!meetsMinVersion("2.8.9", "2.9.0"));
      assert.ok(!meetsMinVersion("2.9.0", "2.9.1"));
    });

    it("treats missing components as zero", () => {
      assert.ok(meetsMinVersion("2.10", "2.10.0"));
      assert.ok(meetsMinVersion("2.10.0", "2.10"));
      assert.ok(!meetsMinVersion("2.10", "2.10.1"));
      assert.ok(meetsMinVersion("2.10.0.1", "2.10.0"));
    });
  });
});
