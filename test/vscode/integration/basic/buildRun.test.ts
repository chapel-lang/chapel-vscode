import * as assert from "assert";
import * as fs from "fs";
import * as vscode from "vscode";
import { activateExtension } from "../../helpers/api";
import { skipWithoutChapel, workspaceUri } from "../../helpers/chapel";
import { runTask } from "../../helpers/fakeBuildTools";

// Below the mocha timeout, so a slow compile fails with a clear message
const TASK_TIMEOUT = 150000;

describe("build and run with chpl", () => {
  let source: string;
  let exe: string;
  let marker: string;
  let original: string | undefined;

  async function buildRunTask(): Promise<vscode.Task> {
    const tasks = await vscode.tasks.fetchTasks({ type: "chpl-build-run" });
    const task = tasks.find((t) => t.name === "Build and Run Program.chpl");
    assert.ok(task, `no task for Program.chpl in ${tasks.map((t) => t.name).join(", ")}`);
    return task;
  }

  before(async function () {
    skipWithoutChapel(this);
    await activateExtension();
    source = workspaceUri("Program.chpl").fsPath;
    exe = workspaceUri("Program").fsPath;
    marker = workspaceUri("Program.marker").fsPath;
    original = fs.readFileSync(source, "utf8");
  });

  beforeEach(() => {
    fs.rmSync(marker, { force: true });
  });

  after(() => {
    if (original === undefined) {
      return;
    }
    fs.writeFileSync(source, original);
    fs.rmSync(exe, { force: true });
    fs.rmSync(marker, { force: true });
  });

  it("compiles and runs the program", async () => {
    fs.rmSync(exe, { force: true });
    assert.strictEqual(await runTask(await buildRunTask(), TASK_TIMEOUT), 0);

    assert.ok(fs.existsSync(exe), "no executable");
    assert.ok(fs.existsSync(marker), "the program did not run");
  });

  it("runs the program again without recompiling it", async () => {
    assert.ok(fs.existsSync(exe), "needs the executable from the previous test");
    const builtAt = fs.statSync(exe).mtimeMs;
    assert.strictEqual(await runTask(await buildRunTask(), TASK_TIMEOUT), 0);

    assert.strictEqual(fs.statSync(exe).mtimeMs, builtAt, "the program was compiled again");
    assert.ok(fs.existsSync(marker), "the program did not run");
  });

  it.skip("fails without running the old executable when compilation fails (#130)", async () => {
    assert.ok(fs.existsSync(exe), "needs the executable from the previous tests");
    fs.writeFileSync(source, "writeln(undefinedThing);\n");
    const past = new Date(Date.now() - 60000);
    fs.utimesSync(exe, past, past);

    assert.notStrictEqual(await runTask(await buildRunTask(), TASK_TIMEOUT), 0);
    assert.ok(!fs.existsSync(marker), "the old executable ran");
  });
});
