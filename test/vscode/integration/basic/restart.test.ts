import * as assert from "assert";
import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../../src/extension";
import { activateExtension } from "../../helpers/api";
import {
  isLintDiagnostic,
  lintViolations,
  requireChapel,
  startServers,
  waitForRestart,
} from "../../helpers/chapel";
import { countToolProcesses } from "../../helpers/processes";
import { waitFor, waitForDiagnostics } from "../../helpers/wait";

describe("restart commands", () => {
  let api: ChapelExtensionApi;

  before(async () => {
    requireChapel();
    api = await activateExtension();
  });

  it("chplcheck.restart restarts chplcheck", async () => {
    const doc = await startServers(api, "Lint.chpl");
    await waitForDiagnostics(doc.uri, () => lintViolations(doc.uri).length > 0, {
      timeout: 60000,
    });
    const previous = api.chplcheck.client;
    await vscode.commands.executeCommand("chplcheck.restart");
    await waitForRestart(api.chplcheck, previous);
    await waitForDiagnostics(doc.uri, () => lintViolations(doc.uri).length > 0, {
      timeout: 60000,
    });
    await waitFor(() => countToolProcesses("chplcheck") === 1, {
      timeout: 20000,
      message: "one chplcheck process",
    });
  });

  it("chpl-language-server.restart restarts chpl-language-server", async () => {
    const doc = await startServers(api, "SyntaxError.chpl");
    const hasClsDiagnostics = (ds: vscode.Diagnostic[]) =>
      ds.some((d) => !isLintDiagnostic(d));
    await waitForDiagnostics(doc.uri, hasClsDiagnostics, { timeout: 60000 });
    const previous = api.cls.client;
    await vscode.commands.executeCommand("chpl-language-server.restart");
    await waitForRestart(api.cls, previous);
    await waitForDiagnostics(doc.uri, hasClsDiagnostics, { timeout: 60000 });
    await waitFor(() => countToolProcesses("chpl-language-server") === 1, {
      timeout: 20000,
      message: "one chpl-language-server process",
    });
    assert.strictEqual(countToolProcesses("chplcheck"), 1);
  });
});
