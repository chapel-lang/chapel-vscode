import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { activateExtension } from "../../helpers/api";
import {
  chplHome,
  skipWithoutChapel,
  workspaceUri,
} from "../../helpers/chapel";
import { waitForTaskEnd } from "../../helpers/fakeBuildTools";

// Below the mocha timeout, so a slow compile fails with a clear message
const TASK_TIMEOUT = 150000;

describe("mason commands", () => {
  let folder: string;
  let originalChplHome: string | undefined;

  async function runMasonCommand(command: string, ...args: unknown[]): Promise<number | undefined> {
    const end = await waitForTaskEnd(
      (t) => t.definition.type === "mason",
      () => vscode.commands.executeCommand(command, ...args),
      TASK_TIMEOUT
    );
    return end.exitCode;
  }

  before(async function () {
    skipWithoutChapel(this);
    await activateExtension();
    folder = workspaceUri().fsPath;
    // Tasks read CHPL_HOME from the extension host's environment; setting chapel.CHPL_HOME
    // would restart the language servers. Without CHPL_HOME mason runs itself (#163).
    originalChplHome = process.env.CHPL_HOME;
    process.env.CHPL_HOME = chplHome();
  });

  afterEach(() => {
    for (const execution of vscode.tasks.taskExecutions) {
      execution.terminate();
    }
    process.env.CHPL_HOME = chplHome();
  });

  after(() => {
    if (originalChplHome === undefined) {
      delete process.env.CHPL_HOME;
    } else {
      process.env.CHPL_HOME = originalChplHome;
    }
    if (folder) {
      fs.rmSync(path.join(folder, "target"), { recursive: true, force: true });
      fs.rmSync(path.join(folder, "Mason.lock"), { force: true });
    }
  });

  it("chapel.mason.build builds the package", async () => {
    const program = path.join(folder, "target", "debug", "MyPkg");
    fs.rmSync(program, { force: true });
    assert.strictEqual(await runMasonCommand("chapel.mason.build"), 0);

    assert.ok(fs.existsSync(program), `no ${program}`);
  });

  it("chapel.mason.test runs the package tests", async () => {
    assert.strictEqual(await runMasonCommand("chapel.mason.test"), 0);
  });

  it("chapel.mason.invokeTestFile runs one test file", async () => {
    const file = path.join(folder, "test", "testGreeting.chpl");
    assert.strictEqual(await runMasonCommand("chapel.mason.invokeTestFile", file), 0);
  });

  it.skip("chapel.mason.build works without CHPL_HOME (#163)", async () => {
    delete process.env.CHPL_HOME;
    assert.strictEqual(await runMasonCommand("chapel.mason.build"), 0);
  });
});
