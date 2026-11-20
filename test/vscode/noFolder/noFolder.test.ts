import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { getExtension } from "../helpers/api";
import { clearRecords, killFakeServers } from "../helpers/fakeTools";
import { stateName, waitForServers } from "../helpers/languageClients";
import { waitFor } from "../helpers/wait";

describe("activation without a workspace folder", () => {
  let tmpDir: string;

  before(() => {
    clearRecords();
    tmpDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "chapel-no-folder-"));
  });

  after(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    killFakeServers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs in an empty window", () => {
    assert.strictEqual(vscode.workspace.workspaceFolders, undefined);
  });

  it("activates when an untitled Chapel document is opened", async () => {
    const ext = getExtension();
    assert.strictEqual(ext.isActive, false);

    await vscode.workspace.openTextDocument({ language: "chapel", content: "writeln(1);\n" });
    await waitFor(() => ext.isActive, { message: "extension to activate" });

    const api = await ext.activate();
    assert.strictEqual(api.chplcheck.name, "chplcheck");
    assert.strictEqual(api.cls.name, "chpl-language-server");
  });

  it("registers every contributed command", async () => {
    await getExtension().activate();
    const contributed: { command: string }[] = getExtension().packageJSON.contributes.commands;
    const registered = new Set(await vscode.commands.getCommands(true));
    for (const { command } of contributed) {
      assert.ok(registered.has(command), `${command} is not registered`);
    }
  });

  it("starts both fake servers for a .chpl file outside any folder", async () => {
    const api = await getExtension().activate();
    const file = path.join(tmpDir, "hello.chpl");
    fs.writeFileSync(file, "writeln(\"hello\");\n");

    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc);
    assert.strictEqual(doc.languageId, "chapel");

    const servers = await waitForServers(api);
    assert.deepStrictEqual(servers.chplcheck.argv, ["--lsp"]);
    assert.strictEqual(stateName(api.cls), "RUNNING");
  });
});
