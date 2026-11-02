import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
// The provider is not exposed through the API, so these load a second copy of the modules
import { createLogger } from "../../../src/logger";
import { ChplLink, ChplTerminalLinkProvider } from "../../../src/TerminalLinks";
import { activateExtension } from "../helpers/api";
import { fakeChplHome } from "../helpers/fakeTools";
import { restoreSettings, setSetting } from "../helpers/settings";
import { waitFor } from "../helpers/wait";

describe("Chapel terminal links", () => {
  let provider: ChplTerminalLinkProvider;
  let tmp: string;

  function linksFor(line: string): ChplLink[] {
    const context = { line, terminal: {} as vscode.Terminal };
    return provider.provideTerminalLinks(context, new vscode.CancellationTokenSource().token) as ChplLink[];
  }

  before(async () => {
    await activateExtension();
    // Not disposed: it shares the extension's log channel, which would close for the extension too
    createLogger();
    provider = new ChplTerminalLinkProvider();
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "chapel-links-"));
  });

  afterEach(async () => {
    sinon.restore();
    await restoreSettings();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("resolves $CHPL_HOME links with the chapel.CHPL_HOME setting", async () => {
    await setSetting("CHPL_HOME", fakeChplHome());
    const links = linksFor("$CHPL_HOME/modules/standard/IO.chpl:12: error: x");

    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].startIndex, 0);
    assert.strictEqual(links[0].length, "$CHPL_HOME/modules/standard/IO.chpl:12".length);
    assert.deepStrictEqual(links[0].data, {
      path: path.join(fakeChplHome(), "modules", "standard", "IO.chpl"),
      lineNum: 12,
    });
  });

  it("opens an existing file with the cursor on the linked line", async () => {
    const file = path.join(tmp, "Linked.chpl");
    fs.writeFileSync(file, Array.from({ length: 20 }, (_, i) => `// line ${i + 1}\n`).join(""));
    provider.handleTerminalLink(new ChplLink(0, 10, file, 12));

    const editor = await waitFor(() => {
      const active = vscode.window.activeTextEditor;
      return active?.document.uri.fsPath === file ? active : undefined;
    }, { message: `${file} to open` });
    await waitFor(() => editor.selection.active.line === 11, {
      message: `the cursor to move to line 12 (at ${editor.selection.active.line + 1})`,
    });
    assert.ok(editor.selection.isEmpty);
  });

  it("searches with quick open when the file does not exist", () => {
    const executeCommand = sinon.stub(vscode.commands, "executeCommand").callThrough();
    const quickOpen = executeCommand.withArgs("workbench.action.quickOpen").resolves(undefined);
    const missing = path.join(tmp, "Missing.chpl");
    provider.handleTerminalLink(new ChplLink(0, 10, missing, 12));

    sinon.assert.calledOnceWithExactly(quickOpen, "workbench.action.quickOpen", `${missing}:12`);
  });
});
