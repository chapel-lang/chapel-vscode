import * as assert from "assert";
import { buildRunWrapperArgs, masonTestFileArgs, runTaskArgs } from "../../../src/util/taskCommands";

describe("util/taskCommands", () => {
  describe("runTaskArgs", () => {
    it("puts --numLocales before the program args", () => {
      assert.deepStrictEqual(runTaskArgs("4", ["--n=10", "foo"]), ["--numLocales=4", "--n=10", "foo"]);
    });

    it("works with no program args", () => {
      assert.deepStrictEqual(runTaskArgs("1", []), ["--numLocales=1"]);
    });
  });

  describe("masonTestFileArgs", () => {
    it("runs a single test file", () => {
      assert.deepStrictEqual(masonTestFileArgs("test/MyTest.chpl"), ["--show", "--", "test/MyTest.chpl"]);
    });

    it("adds a filter before the file", () => {
      assert.deepStrictEqual(
        masonTestFileArgs("test/MyTest.chpl", "testFoo"),
        ["--show", "--filter=testFoo", "--", "test/MyTest.chpl"]
      );
    });

    it("ignores an empty filter", () => {
      assert.deepStrictEqual(masonTestFileArgs("test/MyTest.chpl", ""), ["--show", "--", "test/MyTest.chpl"]);
    });
  });

  describe("buildRunWrapperArgs", () => {
    const base = {
      compiler: "chpl",
      sourceFiles: ["/ws/hello.chpl", "/ws/lib.chpl"],
      executable: "/ws/hello",
      compileArgs: [],
      numLocales: "1",
      runArgs: [],
    };

    it("produces the four wrapper arguments", () => {
      assert.deepStrictEqual(buildRunWrapperArgs(base), [
        "/ws/hello.chpl;/ws/lib.chpl",
        "/ws/hello",
        "chpl /ws/hello.chpl /ws/lib.chpl -o /ws/hello",
        "/ws/hello --numLocales=1",
      ]);
    });

    it("appends compile and run args", () => {
      assert.deepStrictEqual(
        buildRunWrapperArgs({ ...base, compileArgs: ["--fast", "-M", "lib"], numLocales: "2", runArgs: ["--n=10"] }),
        [
          "/ws/hello.chpl;/ws/lib.chpl",
          "/ws/hello",
          "chpl /ws/hello.chpl /ws/lib.chpl -o /ws/hello --fast -M lib",
          "/ws/hello --numLocales=2 --n=10",
        ]
      );
    });

    it.skip("quotes paths with spaces so the wrapper can run them (#143)", () => {
      const [, , buildCommand, runCommand] = buildRunWrapperArgs({
        ...base,
        sourceFiles: ["/my ws/hello.chpl"],
        executable: "/my ws/hello",
      });
      const isQuoted = (cmd: string, p: string) => cmd.includes(`"${p}"`) || cmd.includes(`'${p}'`);
      assert.ok(isQuoted(buildCommand, "/my ws/hello.chpl"), buildCommand);
      assert.ok(isQuoted(buildCommand, "/my ws/hello"), buildCommand);
      assert.ok(isQuoted(runCommand, "/my ws/hello"), runCommand);
    });
  });
});
