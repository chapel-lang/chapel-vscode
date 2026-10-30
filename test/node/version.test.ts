import * as assert from "assert";
import { meetsMinVersion, parseToolVersion } from "../../src/util/version";

describe("util/version", () => {
  it("parses the version from --version output", () => {
    assert.strictEqual(
      parseToolVersion("chpl-language-server 2.10.0 pre-release (e23242670c1)"),
      "2.10.0"
    );
  });

  it("compares versions numerically", () => {
    assert.ok(meetsMinVersion("2.10.0", "2.9.0"));
    assert.ok(!meetsMinVersion("2.8.0", "2.9.0"));
  });
});
