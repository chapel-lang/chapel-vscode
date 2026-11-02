import * as assert from "assert";
import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../../src/extension";
import { activateExtension } from "../../helpers/api";
import {
  ClientState,
  isLintDiagnostic,
  openDocument,
  positionOf,
  restoreSettingsAndRestart,
  setSettingAndRestart,
  skipWithoutChapel,
  startServers,
  workspaceUri,
} from "../../helpers/chapel";
import { processEnvironment, toolProcesses } from "../../helpers/processes";
import { waitFor, waitForDiagnostics } from "../../helpers/wait";

type Locations = (vscode.Location | vscode.LocationLink)[];

function targetUri(location: vscode.Location | vscode.LocationLink): vscode.Uri {
  return "targetUri" in location ? location.targetUri : location.uri;
}

function flattenSymbols(
  symbols: (vscode.DocumentSymbol | vscode.SymbolInformation)[]
): string[] {
  return symbols.flatMap((s) =>
    "children" in s ? [s.name, ...flattenSymbols(s.children)] : [s.name]
  );
}

// The server may answer with nothing until it has finished indexing the file.
function retry<T>(
  fn: () => Thenable<T | undefined>,
  ok: (value: T) => boolean
): Promise<T> {
  return waitFor(
    async () => {
      const value = await fn();
      return value !== undefined && ok(value) ? value : undefined;
    },
    { timeout: 60000, interval: 1000 }
  );
}

describe("chpl-language-server", () => {
  let api: ChapelExtensionApi;

  before(async function () {
    skipWithoutChapel(this);
    api = await activateExtension();
  });

  afterEach(async () => {
    await restoreSettingsAndRestart(api);
  });

  it("reports syntax errors", async () => {
    const doc = await startServers(api, "SyntaxError.chpl");
    const diagnostics = await waitForDiagnostics(
      doc.uri,
      (ds) => ds.some((d) => !isLintDiagnostic(d)),
      { timeout: 60000 }
    );
    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error
    );
    assert.ok(
      errors.some((d) => d.range.start.line === 2),
      JSON.stringify(diagnostics)
    );
  });

  it("goes to a definition in another file", async () => {
    await openDocument("B.chpl");
    const doc = await startServers(api, "A.chpl");
    const locations = await retry(
      () =>
        vscode.commands.executeCommand<Locations>(
          "vscode.executeDefinitionProvider",
          doc.uri,
          positionOf(doc, "greet(")
        ),
      (ls) => ls.length > 0
    );
    assert.strictEqual(targetUri(locations[0]).fsPath, workspaceUri("B.chpl").fsPath);
  });

  it("shows hover content", async () => {
    const doc = await startServers(api, "A.chpl");
    const hovers = await retry(
      () =>
        vscode.commands.executeCommand<vscode.Hover[]>(
          "vscode.executeHoverProvider",
          doc.uri,
          positionOf(doc, "greet(")
        ),
      (hs) => hs.length > 0
    );
    const text = hovers
      .flatMap((h) => h.contents)
      .map((c) => (typeof c === "string" ? c : c.value))
      .join("\n");
    assert.match(text, /greet/);
  });

  it("lists document symbols", async () => {
    const doc = await startServers(api, "B.chpl");
    const symbols = await retry(
      () =>
        vscode.commands.executeCommand<
          (vscode.DocumentSymbol | vscode.SymbolInformation)[]
        >("vscode.executeDocumentSymbolProvider", doc.uri),
      (ss) => ss.length > 0
    );
    const names = flattenSymbols(symbols);
    assert.ok(names.some((n) => n.includes("greet")), JSON.stringify(names));
  });

  it("finds references in another file", async () => {
    await openDocument("B.chpl");
    const doc = await startServers(api, "A.chpl");
    const references = await retry(
      () =>
        vscode.commands.executeCommand<vscode.Location[]>(
          "vscode.executeReferenceProvider",
          doc.uri,
          positionOf(doc, "greet(")
        ),
      (rs) => rs.some((r) => r.uri.fsPath === workspaceUri("B.chpl").fsPath)
    );
    const call = references.find(
      (r) => r.uri.fsPath === workspaceUri("A.chpl").fsPath
    );
    assert.strictEqual(call?.range.start.line, 4);
  });

  it("renames a symbol across files", async () => {
    await openDocument("B.chpl");
    const doc = await startServers(api, "A.chpl");
    const edit = await retry(
      () =>
        vscode.commands.executeCommand<vscode.WorkspaceEdit>(
          "vscode.executeDocumentRenameProvider",
          doc.uri,
          positionOf(doc, "greet("),
          "welcome"
        ),
      (e) => e.entries().length > 1
    );
    const files = edit.entries().map(([uri]) => uri.fsPath).sort();
    assert.deepStrictEqual(
      files,
      [workspaceUri("A.chpl").fsPath, workspaceUri("B.chpl").fsPath].sort()
    );
    for (const [, edits] of edit.entries()) {
      assert.ok(edits.every((e) => e.newText === "welcome"));
    }
  });

  it("passes --resolver when chapel.chpl-language-server.resolver is true", async () => {
    await startServers(api, "A.chpl");
    await setSettingAndRestart(api, "chpl-language-server.resolver", true);
    assert.strictEqual(api.cls.state, ClientState.RUNNING);
    await waitFor(
      () =>
        toolProcesses("chpl-language-server").some((p) =>
          p.args.split(/\s+/).includes("--resolver")
        ),
      { message: "a chpl-language-server process with --resolver" }
    );
  });

  it.skip("passes CHPL_DEVELOPER=1 to the servers when chapel.CHPL_DEVELOPER is true (#142)", async () => {
    await startServers(api, "A.chpl");
    await setSettingAndRestart(api, "CHPL_DEVELOPER", true);
    for (const tool of ["chplcheck", "chpl-language-server"]) {
      await waitFor(
        () =>
          toolProcesses(tool).some((p) =>
            processEnvironment(p.pid).includes("CHPL_DEVELOPER=1")
          ),
        { message: `${tool} with CHPL_DEVELOPER=1` }
      );
    }
  });
});
