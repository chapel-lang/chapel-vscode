import * as assert from "assert";
import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../src/extension";
import { activateExtension } from "../helpers/api";
import { clearRecords, killFakeServers } from "../helpers/fakeTools";
import { waitForServers } from "../helpers/languageClients";
import { waitFor } from "../helpers/wait";

describe("startup with a Chapel file open", () => {
  let api: ChapelExtensionApi;

  before(async () => {
    api = await activateExtension();
  });

  after(() => {
    killFakeServers();
    clearRecords();
  });

  it("opens the .chpl file passed on the command line", async () => {
    await waitFor(
      () => vscode.workspace.textDocuments.some((doc) => doc.uri.path.endsWith("/hello.chpl")),
      { message: "hello.chpl to be open" }
    );
  });

  it.skip("starts both servers without another document being opened (#159)", async () => {
    const servers = await waitForServers(api);
    assert.strictEqual(servers.chplcheck.tool, "chplcheck");
    assert.strictEqual(servers["chpl-language-server"].tool, "chpl-language-server");
  });
});
