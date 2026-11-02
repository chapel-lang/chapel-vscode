import * as assert from "assert";
import * as fs from "fs";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { activateExtension } from "../../helpers/api";
import { chplHome, skipWithoutChapel } from "../../helpers/chapel";

describe("Find CHPL_HOME", () => {
  let originalChplHome: string | undefined;

  before(async function () {
    skipWithoutChapel(this);
    await activateExtension();
    originalChplHome = process.env.CHPL_HOME;
  });

  afterEach(() => {
    sinon.restore();
    if (originalChplHome === undefined) {
      delete process.env.CHPL_HOME;
    } else {
      process.env.CHPL_HOME = originalChplHome;
    }
  });

  async function offeredChplHomes(): Promise<string[]> {
    const pick = sinon.stub(vscode.window, "showQuickPick").resolves(undefined);
    // With no candidates the command asks for a path instead
    sinon.stub(vscode.window, "showInputBox").resolves(undefined);
    await vscode.commands.executeCommand("chapel.findChplHome");
    if (!pick.called) {
      return [];
    }
    return (pick.firstCall.args[0] as unknown as string[]).filter((item) => fs.existsSync(item));
  }

  function realpaths(paths: string[]): string[] {
    return paths.map((p) => fs.realpathSync(p));
  }

  it("offers CHPL_HOME from the environment", async () => {
    process.env.CHPL_HOME = chplHome();
    assert.ok(realpaths(await offeredChplHomes()).includes(fs.realpathSync(chplHome())));
  });

  it.skip("offers the CHPL_HOME of the chpl found on PATH (#148)", async () => {
    delete process.env.CHPL_HOME;
    assert.ok(realpaths(await offeredChplHomes()).includes(fs.realpathSync(chplHome())));
  });

  it.skip("offers each CHPL_HOME once (#154)", async () => {
    process.env.CHPL_HOME = chplHome();
    const offered = realpaths(await offeredChplHomes());
    assert.deepStrictEqual(offered, [...new Set(offered)]);
  });
});
