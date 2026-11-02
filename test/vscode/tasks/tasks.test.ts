import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { activateExtension } from "../helpers/api";
import {
  clearBuildRecords,
  fakeChplPath,
  fakeProgramPath,
  readBuildRecords,
  runTask,
  waitForTaskEnd,
} from "../helpers/fakeBuildTools";

const SOURCE = "writeln(\"hello\");\n";
// These tasks, the settings and the fake tools come from test/scripts/prepare-workspaces.mjs
const ENV_LABEL = "build and run envcheck from tasks.json";
const RUN_LABEL = "run fake program from tasks.json";
const COMPILE_PICKED_LABEL = "compile picked.chpl from tasks.json";

describe("chpl tasks", function () {
  this.timeout(60000);
  let folder: string;

  function ws(...parts: string[]): string {
    return path.join(folder, ...parts);
  }

  // Makes the source newer than its executable, so the next build-and-run compiles again
  function touchSource(source: string, exe: string): void {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    fs.utimesSync(exe, past, past);
    fs.utimesSync(source, now, now);
  }

  async function buildRunTask(fileName: string): Promise<vscode.Task> {
    const tasks = await vscode.tasks.fetchTasks({ type: "chpl-build-run" });
    const task = tasks.find((t) => t.name === `Build and Run ${fileName}`);
    assert.ok(task, `no task for ${fileName} in ${tasks.map((t) => t.name).join(", ")}`);
    return task;
  }

  async function namedTask(type: string, name: string): Promise<vscode.Task> {
    const task = (await vscode.tasks.fetchTasks({ type })).find((t) => t.name === name);
    assert.ok(task, `no ${type} task named ${name}`);
    return task;
  }

  async function openFile(name: string): Promise<void> {
    await vscode.window.showTextDocument(vscode.Uri.file(ws(name)));
  }

  function outputOf(record: { argv: string[] }): string {
    return record.argv[record.argv.indexOf("-o") + 1];
  }

  before(async () => {
    await activateExtension();
    folder = vscode.workspace.workspaceFolders![0].uri.fsPath;
  });

  beforeEach(() => {
    clearBuildRecords();
  });

  afterEach(async () => {
    sinon.restore();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  describe("chpl-build-run", () => {
    it("provides a task for each Chapel file", async () => {
      const task = await buildRunTask("hello.chpl");
      assert.deepStrictEqual(task.definition.sourceFiles, ["${workspaceFolder}/hello.chpl"]);
      const execution = task.execution as vscode.ProcessExecution;
      assert.ok(execution.args[2].startsWith(`${fakeChplPath()} `), execution.args[2]);
    });

    it("compiles and then runs the program", async () => {
      fs.rmSync(ws("hello"), { force: true });
      assert.strictEqual(await runTask(await buildRunTask("hello.chpl")), 0);

      const compiles = readBuildRecords("chpl");
      assert.strictEqual(compiles.length, 1);
      assert.ok(compiles[0].argv.includes(ws("hello.chpl")), compiles[0].argv.join(" "));
      assert.strictEqual(outputOf(compiles[0]), ws("hello"));
      const runs = readBuildRecords("run");
      assert.strictEqual(runs.length, 1);
      assert.deepStrictEqual(runs[0].argv, ["--numLocales=1"]);
      assert.strictEqual(runs[0].exe, ws("hello"));
    });

    it("runs without compiling when the source is unchanged", async () => {
      const task = await buildRunTask("hello.chpl");
      assert.strictEqual(await runTask(task), 0);
      clearBuildRecords();

      assert.strictEqual(await runTask(task), 0);
      assert.strictEqual(readBuildRecords("chpl").length, 0);
      assert.strictEqual(readBuildRecords("run").length, 1);
    });

    it("compiles again when the source is newer than the executable", async () => {
      const task = await buildRunTask("hello.chpl");
      assert.strictEqual(await runTask(task), 0);
      touchSource(ws("hello.chpl"), ws("hello"));
      clearBuildRecords();

      assert.strictEqual(await runTask(task), 0);
      assert.strictEqual(readBuildRecords("chpl").length, 1);
      assert.strictEqual(readBuildRecords("run").length, 1);
    });

    it.skip("fails without running the old executable when compilation fails (#130)", async () => {
      const task = await buildRunTask("stale.chpl");
      fs.writeFileSync(ws("stale.chpl"), SOURCE);
      assert.strictEqual(await runTask(task), 0);
      fs.writeFileSync(ws("stale.chpl"), "COMPILE_ERROR\n");
      touchSource(ws("stale.chpl"), ws("stale"));
      clearBuildRecords();

      assert.notStrictEqual(await runTask(task), 0);
      assert.strictEqual(readBuildRecords("chpl").length, 1);
      assert.strictEqual(readBuildRecords("run").length, 0);
    });

    it.skip("builds and runs files whose path contains spaces (#143)", async () => {
      const source = ws("with space", "spaced.chpl");
      assert.strictEqual(await runTask(await buildRunTask("spaced.chpl")), 0);

      const compiles = readBuildRecords("chpl");
      assert.strictEqual(compiles.length, 1);
      assert.ok(compiles[0].argv.includes(source), compiles[0].argv.join(" "));
      assert.strictEqual(outputOf(compiles[0]), ws("with space", "spaced"));
      assert.deepStrictEqual(readBuildRecords("run").map((r) => r.exe), [ws("with space", "spaced")]);
    });

    it("prefers task env over chapel.baseEnv over the process env", async () => {
      fs.rmSync(ws("envcheck"), { force: true });
      assert.strictEqual(await runTask(await namedTask("chpl-build-run", ENV_LABEL)), 0);

      for (const record of [...readBuildRecords("chpl"), ...readBuildRecords("run")]) {
        assert.strictEqual(record.env.TEST_ENV_PROCESS, "process", record.tool);
        assert.strictEqual(record.env.TEST_ENV_BASE, "baseEnv", record.tool);
        assert.strictEqual(record.env.TEST_ENV_TASK, "task", record.tool);
      }
      assert.strictEqual(readBuildRecords("chpl").length, 1);
      assert.strictEqual(readBuildRecords("run").length, 1);
    });

    it.skip("provides a task for a Chapel file created after the first fetch (#160)", async () => {
      await buildRunTask("hello.chpl");
      fs.writeFileSync(ws("later.chpl"), SOURCE);
      try {
        await buildRunTask("later.chpl");
      } finally {
        fs.rmSync(ws("later.chpl"), { force: true });
      }
    });
  });

  describe("chpl-run", () => {
    it("passes --numLocales=1 by default", async () => {
      const task = await namedTask("chpl-run", RUN_LABEL);
      assert.strictEqual((task.execution as vscode.ProcessExecution).process, fakeProgramPath());
      assert.strictEqual(await runTask(task), 0);

      assert.deepStrictEqual(readBuildRecords("run").map((r) => r.argv), [["--numLocales=1"]]);
      assert.strictEqual(readBuildRecords("chpl").length, 0);
    });
  });

  describe("chapel.runFileTask", () => {
    it("runs the build-and-run task of the active Chapel file", async () => {
      await openFile("hello.chpl");
      const end = await waitForTaskEnd(
        (t) => t.name === "Build and Run hello.chpl",
        () => vscode.commands.executeCommand("chapel.runFileTask")
      );

      assert.strictEqual(end.exitCode, 0);
      assert.deepStrictEqual(readBuildRecords("run").map((r) => r.exe), [ws("hello")]);
    });

    it("shows an error when the active file is not a Chapel file", async () => {
      const showError = sinon.stub(vscode.window, "showErrorMessage").resolves(undefined);
      await openFile("notes.txt");
      await vscode.commands.executeCommand("chapel.runFileTask");

      sinon.assert.calledWith(showError, "The current file is not a Chapel file.");
      assert.strictEqual(readBuildRecords("chpl").length, 0);
    });

    it("shows an error when there is no active editor", async () => {
      const showError = sinon.stub(vscode.window, "showErrorMessage").resolves(undefined);
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await vscode.commands.executeCommand("chapel.runFileTask");

      sinon.assert.calledWith(showError, "No active editor found.");
    });

    it("asks which task to run when several match the file", async () => {
      const quickPick = sinon.stub(vscode.window, "showQuickPick").resolves(COMPILE_PICKED_LABEL as never);
      await openFile("picked.chpl");
      const end = await waitForTaskEnd(
        (t) => t.name === COMPILE_PICKED_LABEL,
        () => vscode.commands.executeCommand("chapel.runFileTask")
      );

      assert.strictEqual(end.exitCode, 0);
      const items = [...(await quickPick.firstCall.args[0])].sort();
      assert.deepStrictEqual(items, ["Build and Run picked.chpl", COMPILE_PICKED_LABEL].sort());
      const compiles = readBuildRecords("chpl");
      assert.strictEqual(compiles.length, 1);
      assert.strictEqual(outputOf(compiles[0]), ws("picked-from-tasks-json"));
      assert.strictEqual(readBuildRecords("run").length, 0);
    });
  });

  describe("mason without a Mason.toml", () => {
    it("provides no mason tasks", async () => {
      assert.deepStrictEqual(await vscode.tasks.fetchTasks({ type: "mason" }), []);
    });

    it("shows an error for chapel.mason.build", async () => {
      const showError = sinon.stub(vscode.window, "showErrorMessage").resolves(undefined);
      await vscode.commands.executeCommand("chapel.mason.build");

      sinon.assert.calledWith(showError, "Could not run Mason command");
      assert.strictEqual(readBuildRecords("mason").length, 0);
    });

    it.skip("provides mason tasks only while Mason.toml exists (#160)", async () => {
      const masonToml = ws("Mason.toml");
      fs.writeFileSync(masonToml, "[brick]\nname = \"later\"\nversion = \"0.1.0\"\nchplVersion = \"2.0.0\"\n");
      try {
        assert.strictEqual((await vscode.tasks.fetchTasks({ type: "mason" })).length, 3);
      } finally {
        fs.rmSync(masonToml, { force: true });
      }
      assert.deepStrictEqual(await vscode.tasks.fetchTasks({ type: "mason" }), []);
    });
  });
});
