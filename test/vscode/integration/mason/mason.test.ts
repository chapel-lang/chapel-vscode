import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../../src/extension";
import { activateExtension, getExtension } from "../../helpers/api";
import {
  clsAtLeast,
  positionOf,
  requireChapel,
  startServers,
  workspaceUri,
} from "../../helpers/chapel";
import { toolProcesses } from "../../helpers/processes";
import { waitFor } from "../../helpers/wait";

type Locations = (vscode.Location | vscode.LocationLink)[];

describe("mason project", () => {
  let api: ChapelExtensionApi;

  before(async () => {
    requireChapel();
    api = await activateExtension();
  });

  it("passes --mason-path only to chpl-language-server 2.9.0 and newer", async () => {
    // Opening src/MyPkg.chpl would let the server find it without mason.
    await startServers(api, "test", "testGreeting.chpl");
    const masonWrapper = path.join(getExtension().extensionPath, "wrappers", "mason");
    const args = await waitFor(
      () => toolProcesses("chpl-language-server").map((p) => p.args.split(/\s+/))[0],
      { message: "a chpl-language-server process" }
    );
    if (clsAtLeast(2, 9)) {
      assert.ok(args.includes(`--mason-path=${masonWrapper}`), args.join(" "));
    } else {
      assert.ok(!args.some((a) => a.startsWith("--mason-path")), args.join(" "));
    }
  });

  it("resolves the package module from a test file", async function () {
    if (!clsAtLeast(2, 9)) {
      this.skip();
    }
    const doc = await startServers(api, "test", "testGreeting.chpl");
    const locations = await waitFor(
      async () => {
        const ls = await vscode.commands.executeCommand<Locations>(
          "vscode.executeDefinitionProvider",
          doc.uri,
          positionOf(doc, "greeting(")
        );
        return ls.length > 0 ? ls : undefined;
      },
      { timeout: 60000, interval: 1000 }
    );
    const location = locations[0];
    const uri = "targetUri" in location ? location.targetUri : location.uri;
    assert.strictEqual(uri.fsPath, workspaceUri("src", "MyPkg.chpl").fsPath);
  });
});
