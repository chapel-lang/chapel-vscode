import * as assert from "assert";
import * as fs from "fs";
import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../../src/extension";
import { activateExtension } from "../../helpers/api";
import {
  positionOf,
  skipWithoutChapel,
  startServers,
  waitForRestart,
  workspaceUri,
} from "../../helpers/chapel";
import { waitFor } from "../../helpers/wait";

type Locations = (vscode.Location | vscode.LocationLink)[];

// CLS looks files up by absolute path, so the commands are generated for this checkout.
function writeClsCommands(): void {
  const main = workspaceUri("Main.chpl").fsPath;
  const helper = workspaceUri("lib", "Helper.chpl").fsPath;
  const command = {
    module_dirs: [workspaceUri("lib").fsPath],
    files: [main, helper],
  };
  const commands = { [main]: [command], [helper]: [command] };
  fs.writeFileSync(
    workspaceUri(".cls-commands.json").fsPath,
    JSON.stringify(commands, undefined, 2)
  );
}

describe(".cls-commands.json", () => {
  let api: ChapelExtensionApi;

  before(async function () {
    skipWithoutChapel(this);
    writeClsCommands();
    api = await activateExtension();
  });

  it("resolves a module from a directory listed in module_dirs", async () => {
    const doc = await startServers(api, "Main.chpl");
    const locations = await waitFor(
      async () => {
        const ls = await vscode.commands.executeCommand<Locations>(
          "vscode.executeDefinitionProvider",
          doc.uri,
          positionOf(doc, "helperProc(")
        );
        return ls.length > 0 ? ls : undefined;
      },
      { timeout: 60000, interval: 1000 }
    );
    const location = locations[0];
    const uri = "targetUri" in location ? location.targetUri : location.uri;
    assert.strictEqual(uri.fsPath, workspaceUri("lib", "Helper.chpl").fsPath);
  });

  it.skip("restarts chpl-language-server when a .cls-commands.json is created (#150)", async () => {
    await startServers(api, "Main.chpl");
    const created = workspaceUri("lib", ".cls-commands.json").fsPath;
    const previous = api.cls.client;
    fs.writeFileSync(created, "{}");
    try {
      await waitForRestart(api.cls, previous, 30000);
    } finally {
      fs.rmSync(created, { force: true });
    }
  });
});
