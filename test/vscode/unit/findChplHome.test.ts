import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { activateExtension } from "../helpers/api";
import { fakeChplHome } from "../helpers/fakeTools";
import { restoreSettings, setSetting } from "../helpers/settings";
import { sleep, waitFor } from "../helpers/wait";

const PICK_MY_OWN = "None of these - let me pick my own";
// Long enough for a selection that should not be saved to have been saved
const SETTLE_MS = 500;

describe("chapel.findChplHome", () => {
  let originalEnv: string | undefined;
  let originalGlobal: string | undefined;
  let showQuickPick: sinon.SinonStub;
  let showInput: sinon.SinonStub;

  function inspectChplHome() {
    return vscode.workspace.getConfiguration("chapel").inspect<string>("CHPL_HOME");
  }

  async function quickPickItems(): Promise<string[]> {
    return [...(await showQuickPick.firstCall.args[0])];
  }

  before(async () => {
    await activateExtension();
  });

  beforeEach(() => {
    originalEnv = process.env.CHPL_HOME;
    originalGlobal = inspectChplHome()?.globalValue;
    process.env.CHPL_HOME = fakeChplHome();
    showQuickPick = sinon.stub(vscode.window, "showQuickPick").resolves(undefined);
    showInput = sinon.stub(vscode.window, "showInputBox").resolves(undefined);
  });

  afterEach(async () => {
    sinon.restore();
    if (originalEnv === undefined) {
      delete process.env.CHPL_HOME;
    } else {
      process.env.CHPL_HOME = originalEnv;
    }
    await vscode.workspace
      .getConfiguration("chapel")
      .update("CHPL_HOME", originalGlobal, vscode.ConfigurationTarget.Global);
    await restoreSettings();
  });

  it("offers $CHPL_HOME and saves the pick to the user settings", async () => {
    showQuickPick.resolves(fakeChplHome());
    await vscode.commands.executeCommand("chapel.findChplHome");

    const items = await quickPickItems();
    assert.ok(items.includes(fakeChplHome()), items.join(", "));
    assert.strictEqual(items[items.length - 1], PICK_MY_OWN);
    await waitFor(() => inspectChplHome()?.globalValue === fakeChplHome(), {
      message: "CHPL_HOME in the user settings",
    });
    assert.strictEqual(inspectChplHome()?.workspaceValue, undefined);
  });

  it("saves the pick to the workspace settings when they set CHPL_HOME", async () => {
    await setSetting("CHPL_HOME", "/old/chpl/home");
    showQuickPick.resolves(fakeChplHome());
    await vscode.commands.executeCommand("chapel.findChplHome");

    await waitFor(() => inspectChplHome()?.workspaceValue === fakeChplHome(), {
      message: "CHPL_HOME in the workspace settings",
    });
    assert.strictEqual(inspectChplHome()?.globalValue, originalGlobal);
  });

  it("saves the path typed in after choosing to pick my own", async () => {
    showQuickPick.resolves(PICK_MY_OWN);
    showInput.resolves("/typed/chpl/home");
    await vscode.commands.executeCommand("chapel.findChplHome");

    await waitFor(() => inspectChplHome()?.globalValue === "/typed/chpl/home", {
      message: "the typed CHPL_HOME in the user settings",
    });
    sinon.assert.calledOnce(showInput);
  });

  it("saves nothing when the quick pick is dismissed", async () => {
    await vscode.commands.executeCommand("chapel.findChplHome");
    await sleep(SETTLE_MS);

    sinon.assert.calledOnce(showQuickPick);
    sinon.assert.notCalled(showInput);
    assert.strictEqual(inspectChplHome()?.globalValue, originalGlobal);
    assert.strictEqual(inspectChplHome()?.workspaceValue, undefined);
  });
});
