import * as assert from "assert";
import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../src/extension";
import { activateExtension } from "../helpers/api";
import { FAKE_TOOLS, clearRecords, isAlive, liveRecords, readRecords } from "../helpers/fakeTools";
import {
  SETTLE_MS,
  applySettings,
  clientFor,
  fakeServerSettings,
  isStatusBarVisible,
  openHello,
  pidsOf,
  resetLanguageClients,
  setProcessEnv,
  startFakeServers,
  stateName,
  trackStatusBar,
  waitForServers,
} from "../helpers/languageClients";
import { sleep, waitFor } from "../helpers/wait";

describe("language client errors", () => {
  let api: ChapelExtensionApi;

  before(async () => {
    api = await activateExtension();
    trackStatusBar(api.chplcheck);
    trackStatusBar(api.cls);
  });

  beforeEach(() => {
    clearRecords();
  });

  afterEach(async () => {
    await resetLanguageClients(api);
  });

  function waitForState(state: string): Promise<boolean> {
    return waitFor(
      () => FAKE_TOOLS.every((tool) => stateName(clientFor(api, tool)) === state),
      { message: `both clients to be ${state}` }
    );
  }

  it("reports a missing tool and recovers once the path is fixed", async () => {
    await applySettings(fakeServerSettings({
      "chplcheck.path": "/nonexistent/chplcheck",
      "chpl-language-server.path": "/nonexistent/chpl-language-server",
    }));
    await waitForState("ERRORED");
    for (const tool of FAKE_TOOLS) {
      assert.ok(isStatusBarVisible(clientFor(api, tool)), `${tool} status bar is hidden`);
    }
    assert.deepStrictEqual(readRecords(), []);

    await startFakeServers(api);
    for (const tool of FAKE_TOOLS) {
      assert.ok(!isStatusBarVisible(clientFor(api, tool)), `${tool} status bar is shown`);
    }
  });

  it("reports a server that exits and restarts it on request", async () => {
    // Set in the extension host env instead of chapel.baseEnv so the restart below does not inherit it
    setProcessEnv("FAKE_LSP_MODE", "exit-on-open");
    await applySettings(fakeServerSettings());
    await waitFor(() => readRecords().length === FAKE_TOOLS.length, { message: "both servers to start" });
    await openHello();

    await waitForState("ERRORED");
    for (const tool of FAKE_TOOLS) {
      assert.ok(isStatusBarVisible(clientFor(api, tool)), `${tool} status bar is hidden`);
    }

    setProcessEnv("FAKE_LSP_MODE", "normal");
    const crashed = readRecords().map((record) => record.pid);
    for (const tool of FAKE_TOOLS) {
      await vscode.commands.executeCommand(`${tool}.restart`);
    }
    await waitForServers(api, crashed);
    for (const tool of FAKE_TOOLS) {
      assert.ok(!isStatusBarVisible(clientFor(api, tool)), `${tool} status bar is shown`);
    }
  });

  it.skip("keeps a server running after a failed request (#151)", async () => {
    const servers = await startFakeServers(api, { baseEnv: { "FAKE_LSP_MODE": "fail-hover" } });
    const doc = await openHello();

    await vscode.commands
      .executeCommand("vscode.executeHoverProvider", doc.uri, new vscode.Position(0, 0))
      .then(undefined, () => undefined);
    await sleep(SETTLE_MS);

    for (const tool of FAKE_TOOLS) {
      assert.strictEqual(stateName(clientFor(api, tool)), "RUNNING", `${tool} state`);
      assert.ok(isAlive(servers[tool].pid), `${tool} server exited`);
    }
  });

  it.skip("leaves one server per tool after restarts during a slow start (#152)", async function () {
    this.timeout(40000);
    await applySettings(fakeServerSettings({
      baseEnv: { "FAKE_LSP_MODE": "slow-init", "FAKE_LSP_DELAY_MS": "3000" },
    }));
    for (const round of [1, 2, 3]) {
      if (round > 1) {
        await applySettings({ "chplcheck.args": [`--round-${round}`] });
      }
      await waitFor(
        () => FAKE_TOOLS.every((tool) => readRecords(tool).length >= round),
        { message: `start number ${round} of each server` }
      );
      assert.ok(FAKE_TOOLS.every((tool) => stateName(clientFor(api, tool)) === "STARTING"));
    }

    await waitForState("RUNNING");
    await sleep(3000 + SETTLE_MS);
    for (const tool of FAKE_TOOLS) {
      assert.strictEqual(liveRecords(tool).length, 1, `live ${tool} servers`);
    }
  });

  it.skip("stays disabled without a status bar when the tool cannot be found (#153)", async () => {
    const before = pidsOf(await startFakeServers(api));
    // Hide the real Chapel tools on PATH
    setProcessEnv("PATH", "/usr/bin:/bin");
    await applySettings({
      "chplcheck.enable": false,
      "chplcheck.path": undefined,
      "chpl-language-server.enable": false,
      "chpl-language-server.path": undefined,
    });
    await sleep(SETTLE_MS);

    for (const tool of FAKE_TOOLS) {
      const client = clientFor(api, tool);
      assert.strictEqual(stateName(client), "DISABLED", `${tool} state`);
      assert.ok(!isStatusBarVisible(client), `${tool} status bar is shown`);
    }
    await waitFor(() => before.every((pid) => !isAlive(pid)), { message: "servers to exit" });
  });
});
