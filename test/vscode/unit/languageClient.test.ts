import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../src/extension";
import { activateExtension, getExtension } from "../helpers/api";
import {
  FAKE_TOOLS,
  clearRecords,
  fakeChplHome,
  fakeChplHomeToolPath,
  fakeToolPath,
  isAlive,
  liveRecords,
  readRecords,
} from "../helpers/fakeTools";
import {
  SETTLE_MS,
  applySettings,
  clientFor,
  fakeServerSettings,
  openHello,
  pidsOf,
  resetLanguageClients,
  startFakeServers,
  stateName,
  waitForServers,
} from "../helpers/languageClients";
import { setSetting } from "../helpers/settings";
import { sleep, waitFor, waitForDiagnostics } from "../helpers/wait";

describe("language clients", () => {
  let api: ChapelExtensionApi;

  before(async () => {
    api = await activateExtension();
  });

  beforeEach(() => {
    clearRecords();
  });

  afterEach(async () => {
    await resetLanguageClients(api);
  });

  it("starts both servers and shows their diagnostics", async () => {
    await startFakeServers(api);
    const doc = await openHello();

    await waitForDiagnostics(doc.uri, (diagnostics) =>
      FAKE_TOOLS.every((tool) =>
        diagnostics.some((d) => d.source === tool && d.message === `fake diagnostic from ${tool}`)
      )
    );
    assert.strictEqual(stateName(api.chplcheck), "RUNNING");
    assert.strictEqual(stateName(api.cls), "RUNNING");
  });

  describe("arguments", () => {
    it("passes --lsp and chplcheck.args to chplcheck", async () => {
      const servers = await startFakeServers(api, { "chplcheck.args": ["--fake-flag", "value"] });
      assert.deepStrictEqual(servers.chplcheck.argv, ["--lsp", "--fake-flag", "value"]);
    });

    it("passes chpl-language-server.args to chpl-language-server", async () => {
      const servers = await startFakeServers(api, { "chpl-language-server.args": ["--fake-flag"] });
      assert.strictEqual(servers["chpl-language-server"].argv.at(-1), "--fake-flag");
    });

    it("passes --mason-path to chpl-language-server 2.10.0", async () => {
      const servers = await startFakeServers(api, { baseEnv: { "FAKE_LSP_VERSION": "2.10.0" } });
      const masonPath = path.join(getExtension().extensionPath, "wrappers", "mason");
      assert.ok(
        servers["chpl-language-server"].argv.includes(`--mason-path=${masonPath}`),
        `argv: ${servers["chpl-language-server"].argv}`
      );
    });

    it("does not pass --mason-path to chpl-language-server 2.8.0", async () => {
      const servers = await startFakeServers(api, { baseEnv: { "FAKE_LSP_VERSION": "2.8.0" } });
      const argv = servers["chpl-language-server"].argv;
      assert.ok(!argv.some((arg) => arg.startsWith("--mason-path")), `argv: ${argv}`);
    });

    it("passes --resolver when chpl-language-server.resolver is set", async () => {
      const servers = await startFakeServers(api, { "chpl-language-server.resolver": true });
      assert.ok(servers["chpl-language-server"].argv.includes("--resolver"));
    });

    it("does not pass --resolver by default", async () => {
      const servers = await startFakeServers(api);
      assert.ok(!servers["chpl-language-server"].argv.includes("--resolver"));
    });
  });

  describe("tool discovery", () => {
    it("prefers the path setting over CHPL_HOME", async () => {
      const servers = await startFakeServers(api, { "CHPL_HOME": fakeChplHome() });
      for (const tool of FAKE_TOOLS) {
        assert.strictEqual(servers[tool].env.FAKE_LSP_SHIM, fakeToolPath(tool));
      }
    });

    it("uses the tools in CHPL_HOME when no path is set", async () => {
      const servers = await startFakeServers(api, {
        "CHPL_HOME": fakeChplHome(),
        "chplcheck.path": undefined,
        "chpl-language-server.path": undefined,
      });
      for (const tool of FAKE_TOOLS) {
        assert.strictEqual(servers[tool].env.FAKE_LSP_SHIM, fakeChplHomeToolPath(tool));
        assert.strictEqual(servers[tool].env.CHPL_HOME, fakeChplHome());
      }
    });
  });

  describe("environment", () => {
    it("forwards chapel.baseEnv to the servers", async () => {
      const servers = await startFakeServers(api, { baseEnv: { "TEST_BASE_ENV": "from-settings" } });
      for (const tool of FAKE_TOOLS) {
        assert.strictEqual(servers[tool].env.TEST_BASE_ENV, "from-settings");
      }
    });

    it("sets CHPL_DEVELOPER=0 by default", async () => {
      const servers = await startFakeServers(api);
      for (const tool of FAKE_TOOLS) {
        assert.strictEqual(servers[tool].env.CHPL_DEVELOPER, "0");
      }
    });

    it.skip("sets CHPL_DEVELOPER=1 when chapel.CHPL_DEVELOPER is true (#142)", async () => {
      const servers = await startFakeServers(api, { "CHPL_DEVELOPER": true });
      for (const tool of FAKE_TOOLS) {
        assert.strictEqual(servers[tool].env.CHPL_DEVELOPER, "1");
      }
    });
  });

  describe("restarts", () => {
    async function assertRestartedOnce(before: number[], expectedArg: string): Promise<void> {
      const after = await waitForServers(api, before);
      await sleep(SETTLE_MS);
      for (const tool of FAKE_TOOLS) {
        const started = readRecords(tool).filter((record) => !before.includes(record.pid));
        assert.strictEqual(started.length, 1, `${tool} started ${started.length} times`);
      }
      assert.ok(after.chplcheck.argv.includes(expectedArg), `argv: ${after.chplcheck.argv}`);
      await waitFor(() => before.every((pid) => !isAlive(pid)), { message: "old servers to exit" });
    }

    it("restarts each server once after a settings change", async () => {
      const before = pidsOf(await startFakeServers(api));
      await setSetting("chplcheck.args", ["--changed"]);
      await assertRestartedOnce(before, "--changed");
    });

    it("restarts each server once after rapid settings changes", async () => {
      const before = pidsOf(await startFakeServers(api));
      await setSetting("chplcheck.args", ["--first"]);
      await setSetting("chplcheck.args", ["--second"]);
      await setSetting("chplcheck.args", ["--third"]);
      await assertRestartedOnce(before, "--third");
    });

    for (const tool of FAKE_TOOLS) {
      it(`${tool}.restart starts a new ${tool} server`, async () => {
        const before = await startFakeServers(api);
        await vscode.commands.executeCommand(`${tool}.restart`);

        await waitFor(() => {
          const live = liveRecords(tool);
          return live.length === 1 && live[0].pid !== before[tool].pid && stateName(clientFor(api, tool)) === "RUNNING";
        }, { message: `a new ${tool} server` });
        await sleep(SETTLE_MS);
        for (const t of FAKE_TOOLS) {
          assert.strictEqual(liveRecords(t).length, 1, `live ${t} servers`);
        }
        assert.ok(!isAlive(before[tool].pid), "old server is still alive");
      });
    }
  });

  it("does not start disabled servers", async () => {
    await applySettings(fakeServerSettings({ "chplcheck.enable": false, "chpl-language-server.enable": false }));
    await sleep(SETTLE_MS);
    await openHello();
    await sleep(SETTLE_MS);

    assert.strictEqual(stateName(api.chplcheck), "DISABLED");
    assert.strictEqual(stateName(api.cls), "DISABLED");
    assert.deepStrictEqual(readRecords(), []);
  });
});
