import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { activateExtension } from "../helpers/api";

describe("chapel.searchDocs", () => {
  let executeCommand: sinon.SinonStub;
  let showBrowser: sinon.SinonStub;

  before(async () => {
    await activateExtension();
  });

  beforeEach(() => {
    executeCommand = sinon.stub(vscode.commands, "executeCommand").callThrough();
    showBrowser = executeCommand.withArgs("simpleBrowser.show").resolves(undefined);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("opens the documentation search for the keyword", async () => {
    sinon.stub(vscode.window, "showInputBox").resolves("forall loops");
    await vscode.commands.executeCommand("chapel.searchDocs");

    sinon.assert.calledOnce(showBrowser);
    const url = new URL(showBrowser.firstCall.args[1]);
    assert.strictEqual(`${url.origin}${url.pathname}`, "https://chapel-lang.org/docs/search.html");
    assert.ok(url.search.includes("q=forall%20loops"), url.href);
  });

  for (const [description, keyword] of [["empty", ""], ["dismissed", undefined]]) {
    it(`does nothing when the input is ${description}`, async () => {
      sinon.stub(vscode.window, "showInputBox").resolves(keyword);
      await vscode.commands.executeCommand("chapel.searchDocs");

      assert.deepStrictEqual(executeCommand.getCalls().map((call) => call.args[0]), ["chapel.searchDocs"]);
    });
  }
});
