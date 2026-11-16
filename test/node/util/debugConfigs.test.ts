import * as assert from "assert";
import {
  createCppdbgDebugConfig,
  createLLDBDebugConfig,
  executablePathsForFile,
} from "../../../src/util/debugConfigs";

describe("util/debugConfigs", () => {
  const env = new Map([["CHPL_HOME", "/opt/chapel"], ["FOO", "bar"]]);

  describe("createLLDBDebugConfig", () => {
    it("builds a CodeLLDB launch config with an env object", () => {
      assert.deepStrictEqual(
        createLLDBDebugConfig("Debug hello", "${workspaceFolder}/hello", ["--n=1"], env),
        {
          name: "Debug hello",
          type: "lldb",
          request: "launch",
          program: "${workspaceFolder}/hello",
          cwd: "${workspaceFolder}",
          args: ["--n=1"],
          env: { CHPL_HOME: "/opt/chapel", FOO: "bar" },
          sourceLanguages: ["chapel"],
        }
      );
    });

    it("defaults to no args and an empty env", () => {
      const config = createLLDBDebugConfig("Debug hello", "/ws/hello");
      assert.deepStrictEqual(config.args, []);
      assert.deepStrictEqual(config.env, {});
    });
  });

  describe("createCppdbgDebugConfig", () => {
    it("builds a cppdbg launch config with an environment array", () => {
      assert.deepStrictEqual(
        createCppdbgDebugConfig("Debug hello", "${workspaceFolder}/hello", ["--n=1"], env),
        {
          name: "Debug hello",
          type: "cppdbg",
          request: "launch",
          program: "${workspaceFolder}/hello",
          cwd: "${workspaceFolder}",
          args: ["--n=1"],
          environment: [
            { name: "CHPL_HOME", value: "/opt/chapel" },
            { name: "FOO", value: "bar" },
          ],
          stopAtEntry: false,
          linux: { MIMode: "gdb" },
          osx: { MIMode: "lldb" },
        }
      );
    });

    it("defaults to no args and an empty environment", () => {
      const config = createCppdbgDebugConfig("Debug hello", "/ws/hello");
      assert.deepStrictEqual(config.args, []);
      assert.deepStrictEqual(config.environment, []);
    });
  });

  describe("executablePathsForFile", () => {
    it("makes paths relative to the workspace for a file inside it", () => {
      assert.deepStrictEqual(executablePathsForFile("/ws/src/hello.chpl", "/ws"), {
        executablePath: "/ws/src/hello",
        niceName: "src/hello",
        relPath: "${workspaceFolder}/src/hello",
      });
    });

    it("uses the base name and absolute path without a workspace", () => {
      assert.deepStrictEqual(executablePathsForFile("/ws/src/hello.chpl", undefined), {
        executablePath: "/ws/src/hello",
        niceName: "hello",
        relPath: "/ws/src/hello",
      });
    });

    it("only strips the last extension", () => {
      assert.strictEqual(
        executablePathsForFile("/ws/v1.2/hello.test.chpl", "/ws")?.executablePath,
        "/ws/v1.2/hello.test"
      );
    });

    it("returns undefined for a file with no extension", () => {
      assert.strictEqual(executablePathsForFile("/ws/hello", "/ws"), undefined);
    });

    it.skip("uses the absolute program path for a file outside the workspace (#147)", () => {
      assert.strictEqual(executablePathsForFile("/other/hello.chpl", "/ws")?.relPath, "/other/hello");
      assert.strictEqual(executablePathsForFile("/ws2/hello.chpl", "/ws")?.relPath, "/ws2/hello");
      assert.strictEqual(executablePathsForFile("/other/ws/hello.chpl", "/ws")?.relPath, "/other/ws/hello");
    });
  });
});
