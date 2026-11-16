import * as assert from "assert";
import { computeEnvAffectingChapel } from "../../../src/util/env";

describe("util/env", () => {
  const noOpts = { chplHome: undefined, chplDeveloper: undefined, baseEnv: new Map<string, string>() };

  it("includes Chapel-related variables", () => {
    const processEnv = {
      CHPL_TARGET_COMPILER: "llvm",
      CHPL_RT_NUM_THREADS_PER_LOCALE: "4",
      GASNET_SPAWNFN: "L",
      FI_PROVIDER: "tcp",
      SLURM_PARTITION: "debug",
      PBS_JOBID: "1",
      QTHREAD_STACK_SIZE: "8192",
      QT_AFFINITY: "no",
      ASAN_OPTIONS: "detect_leaks=0",
    };
    assert.deepStrictEqual(
      computeEnvAffectingChapel(processEnv, noOpts),
      new Map(Object.entries(processEnv))
    );
  });

  it("excludes unrelated variables", () => {
    const env = computeEnvAffectingChapel(
      {
        PATH: "/usr/bin",
        HOME: "/home/me",
        MY_CHPL_VAR: "x",
        QTX: "x",
        ASAN_OPTIONS_EXTRA: "x",
        CHPL_COMM: "none",
      },
      noOpts
    );
    assert.deepStrictEqual(env, new Map([["CHPL_COMM", "none"]]));
  });

  it("includes variables matching extraGlobs", () => {
    const env = computeEnvAffectingChapel({ PATH: "/usr/bin", HOME: "/home/me" }, noOpts, ["PATH"]);
    assert.deepStrictEqual(env, new Map([["PATH", "/usr/bin"]]));
  });

  describe("CHPL_HOME", () => {
    it("prefers the setting over the process env", () => {
      const env = computeEnvAffectingChapel({ CHPL_HOME: "/env" }, { ...noOpts, chplHome: "/setting" });
      assert.strictEqual(env.get("CHPL_HOME"), "/setting");
    });

    it("falls back to the process env when the setting is empty or undefined", () => {
      assert.strictEqual(
        computeEnvAffectingChapel({ CHPL_HOME: "/env" }, { ...noOpts, chplHome: "" }).get("CHPL_HOME"),
        "/env"
      );
      assert.strictEqual(
        computeEnvAffectingChapel({ CHPL_HOME: "/env" }, noOpts).get("CHPL_HOME"),
        "/env"
      );
    });

    it("is absent when neither the setting nor the process env has it", () => {
      assert.ok(!computeEnvAffectingChapel({}, noOpts).has("CHPL_HOME"));
    });
  });

  describe("CHPL_DEVELOPER", () => {
    it("is '1' when the setting is true", () => {
      const env = computeEnvAffectingChapel({ CHPL_DEVELOPER: "0" }, { ...noOpts, chplDeveloper: true });
      assert.strictEqual(env.get("CHPL_DEVELOPER"), "1");
    });

    it("uses the process env when the setting is false or undefined", () => {
      assert.strictEqual(
        computeEnvAffectingChapel({ CHPL_DEVELOPER: "true" }, { ...noOpts, chplDeveloper: false }).get("CHPL_DEVELOPER"),
        "true"
      );
      assert.strictEqual(
        computeEnvAffectingChapel({ CHPL_DEVELOPER: "true" }, noOpts).get("CHPL_DEVELOPER"),
        "true"
      );
    });

    it("is absent when the setting is false and the process env lacks it", () => {
      assert.ok(!computeEnvAffectingChapel({}, { ...noOpts, chplDeveloper: false }).has("CHPL_DEVELOPER"));
    });
  });

  it("lets baseEnv override everything", () => {
    const env = computeEnvAffectingChapel(
      { CHPL_HOME: "/env", CHPL_COMM: "gasnet" },
      {
        chplHome: "/setting",
        chplDeveloper: true,
        baseEnv: new Map([
          ["CHPL_HOME", "/base"],
          ["CHPL_DEVELOPER", "0"],
          ["CHPL_COMM", "none"],
          ["FOO", "bar"],
        ]),
      }
    );
    assert.deepStrictEqual(
      env,
      new Map([
        ["CHPL_HOME", "/base"],
        ["CHPL_COMM", "none"],
        ["CHPL_DEVELOPER", "0"],
        ["FOO", "bar"],
      ])
    );
  });
});
