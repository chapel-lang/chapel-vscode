import * as assert from "assert";
import type { ChapelExtensionApi } from "../../../../src/extension";
import { activateExtension } from "../../helpers/api";
import {
  ClientState,
  Violation,
  chplcheckCli,
  lintViolations,
  restoreSettingsAndRestart,
  setSettingAndRestart,
  requireChapel,
  startServers,
} from "../../helpers/chapel";
import { countToolProcesses } from "../../helpers/processes";
import { waitFor, waitForDiagnostics } from "../../helpers/wait";

function sorted(violations: Violation[]): string[] {
  return violations.map((v) => `${v.rule}:${v.line}`).sort();
}

describe("chplcheck", () => {
  let api: ChapelExtensionApi;

  before(async () => {
    requireChapel();
    api = await activateExtension();
  });

  afterEach(async () => {
    await restoreSettingsAndRestart(api);
  });

  it("reports the same violations as the chplcheck CLI", async () => {
    const doc = await startServers(api, "Lint.chpl");
    const expected = chplcheckCli(api.chplcheck.tool_path, doc.uri.fsPath);
    assert.ok(expected.length > 0, "the CLI found no violations");
    await waitForDiagnostics(doc.uri, () => lintViolations(doc.uri).length > 0, {
      timeout: 60000,
    });
    assert.deepStrictEqual(sorted(lintViolations(doc.uri)), sorted(expected));
  });

  it("passes chapel.chplcheck.args to the server", async () => {
    const doc = await startServers(api, "Lint.chpl");
    await waitForDiagnostics(
      doc.uri,
      () => lintViolations(doc.uri).some((v) => v.rule === "UnusedFormal"),
      { timeout: 60000 }
    );
    await setSettingAndRestart(api, "chplcheck.args", [
      "--disable-rule",
      "UnusedFormal",
    ]);
    await waitForDiagnostics(
      doc.uri,
      () => {
        const rules = lintViolations(doc.uri).map((v) => v.rule);
        return rules.length > 0 && !rules.includes("UnusedFormal");
      },
      { timeout: 60000 }
    );
  });

  it("stops linting when chapel.chplcheck.enable is false", async () => {
    const doc = await startServers(api, "Lint.chpl");
    await waitForDiagnostics(doc.uri, () => lintViolations(doc.uri).length > 0, {
      timeout: 60000,
    });
    await setSettingAndRestart(api, "chplcheck.enable", false);
    assert.strictEqual(api.chplcheck.state, ClientState.DISABLED);
    await waitForDiagnostics(doc.uri, () => lintViolations(doc.uri).length === 0);
    await waitFor(() => countToolProcesses("chplcheck") === 0, {
      timeout: 20000,
      message: "chplcheck server to exit",
    });
  });
});
