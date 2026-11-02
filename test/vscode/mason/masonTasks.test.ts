import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { activateExtension } from "../helpers/api";
import {
  FakeBuildRecord,
  clearBuildRecords,
  fakeChplPath,
  fakeMasonPath,
  readBuildRecords,
  waitForTaskEnd,
} from "../helpers/fakeBuildTools";

describe("mason tasks", function () {
  this.timeout(60000);
  let folder: string;

  async function runMasonCommand(command: string, ...args: unknown[]): Promise<FakeBuildRecord> {
    const end = await waitForTaskEnd(
      (t) => t.definition.type === "mason",
      () => vscode.commands.executeCommand(command, ...args)
    );
    assert.strictEqual(end.exitCode, 0);
    const records = readBuildRecords("mason");
    assert.strictEqual(records.length, 1);
    return records[0];
  }

  function assertCwd(record: FakeBuildRecord, expected: string): void {
    assert.strictEqual(fs.realpathSync(record.cwd), fs.realpathSync(expected));
  }

  before(async () => {
    await activateExtension();
    folder = vscode.workspace.workspaceFolders![0].uri.fsPath;
  });

  beforeEach(() => {
    clearBuildRecords();
  });

  it("provides build, test and run tasks", async () => {
    const tasks = await vscode.tasks.fetchTasks({ type: "mason" });
    const byName = Object.fromEntries(tasks.map((t) => [t.name, t]));
    assert.deepStrictEqual(Object.keys(byName).sort(), ["mason build", "mason run", "mason test"]);
    for (const [name, args] of [["mason build", ["build"]], ["mason test", ["test"]], ["mason run", ["run", "--build"]]] as const) {
      const execution = byName[name].execution as vscode.ProcessExecution;
      assert.strictEqual(execution.process, fakeMasonPath(), name);
      assert.deepStrictEqual(execution.args, args, name);
    }
  });

  for (const [command, args] of [
    ["build", ["build"]],
    ["test", ["test"]],
    ["run", ["run", "--build"]],
  ] as const) {
    it(`chapel.mason.${command} runs mason ${args.join(" ")} in the workspace`, async () => {
      const record = await runMasonCommand(`chapel.mason.${command}`);
      assert.deepStrictEqual(record.argv, args);
      assertCwd(record, folder);
    });
  }

  it("puts the default compiler's directory first on PATH", async () => {
    const record = await runMasonCommand("chapel.mason.build");
    const first = record.env.PATH?.split(path.delimiter)[0];
    assert.strictEqual(first, path.dirname(fakeChplPath()));
  });

  it("chapel.mason.invokeTestFile runs one test file with a filter", async () => {
    const file = path.join(folder, "test", "MasonFakeTest.chpl");
    const record = await runMasonCommand("chapel.mason.invokeTestFile", file, "myFilter", path.join(folder, "Mason.toml"));
    assert.deepStrictEqual(record.argv, ["test", "--show", "--filter=myFilter", "--", file]);
    assertCwd(record, folder);
  });

  it("chapel.mason.invokeTestFile omits --filter without a filter", async () => {
    const file = path.join(folder, "test", "MasonFakeTest.chpl");
    const record = await runMasonCommand("chapel.mason.invokeTestFile", file);
    assert.deepStrictEqual(record.argv, ["test", "--show", "--", file]);
    assertCwd(record, folder);
  });
});
