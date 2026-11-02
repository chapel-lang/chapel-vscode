import * as assert from "assert";
import { mergeEnvPreferUser, parseArgsInput, parseEnvInput } from "../../../src/util/debugInput";

describe("util/debugInput", () => {
  describe("parseArgsInput", () => {
    it("splits on commas and trims each arg", () => {
      assert.deepStrictEqual(parseArgsInput("--n=10, --verbose ,foo"), ["--n=10", "--verbose", "foo"]);
    });

    it("keeps spaces inside an arg", () => {
      assert.deepStrictEqual(parseArgsInput("hello world"), ["hello world"]);
    });

    it("returns no args for empty or undefined input", () => {
      assert.deepStrictEqual(parseArgsInput(""), []);
      assert.deepStrictEqual(parseArgsInput(undefined), []);
    });

    it.skip("returns no args for whitespace-only input (#155)", () => {
      assert.deepStrictEqual(parseArgsInput("   "), []);
    });
  });

  describe("parseEnvInput", () => {
    it("parses comma-separated KEY=value pairs and trims them", () => {
      assert.deepStrictEqual(
        parseEnvInput("CHPL_RT_NUM_THREADS_PER_LOCALE=4, FOO = bar"),
        new Map([["CHPL_RT_NUM_THREADS_PER_LOCALE", "4"], ["FOO", "bar"]])
      );
    });

    it("ignores entries without a value", () => {
      assert.deepStrictEqual(parseEnvInput("FOO,BAR=1"), new Map([["BAR", "1"]]));
    });

    it("returns an empty map for empty or undefined input", () => {
      assert.strictEqual(parseEnvInput("").size, 0);
      assert.strictEqual(parseEnvInput(undefined).size, 0);
    });

    it.skip("keeps everything after the first '=' in the value (#146)", () => {
      assert.deepStrictEqual(parseEnvInput("KEY=a=b"), new Map([["KEY", "a=b"]]));
    });
  });

  describe("mergeEnvPreferUser", () => {
    it("keeps user values and adds missing base values", () => {
      const user = new Map([["CHPL_HOME", "/user"], ["FOO", "1"]]);
      const base = new Map([["CHPL_HOME", "/base"], ["CHPL_DEVELOPER", "1"]]);
      const merged = mergeEnvPreferUser(user, base);
      assert.deepStrictEqual(
        merged,
        new Map([["CHPL_HOME", "/user"], ["FOO", "1"], ["CHPL_DEVELOPER", "1"]])
      );
    });

    it("mutates and returns the user map", () => {
      const user = new Map<string, string>();
      const merged = mergeEnvPreferUser(user, new Map([["A", "1"]]));
      assert.strictEqual(merged, user);
      assert.strictEqual(user.get("A"), "1");
    });
  });
});
