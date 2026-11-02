import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../src/extension";
import { activateExtension } from "../helpers/api";
import { FakeTool, clearRecords, isAlive, liveRecords, readRecords } from "../helpers/fakeTools";
import {
  SETTLE_MS,
  ServerRecords,
  resetLanguageClients,
  startFakeServers,
  stateName,
} from "../helpers/languageClients";
import { sleep, waitFor } from "../helpers/wait";

const CLS = "chpl-language-server";
const MASON_TOML = "[brick]\nname = \"watched\"\nversion = \"0.1.0\"\nchplVersion = \"2.0.0\"\n";
// File events arriving close together can be coalesced, turning a create + change into one create.
const FS_EVENT_SETTLE_MS = 2000;
const RESTART_TIMEOUT_MS = 20000;

describe("file watchers", function () {
  this.timeout(60000);
  let api: ChapelExtensionApi;
  let folder: string;
  const created: string[] = [];

  function writeWorkspaceFile(name: string, content: string): void {
    const file = path.join(folder, name);
    if (!created.includes(file)) {
      created.push(file);
    }
    fs.writeFileSync(file, content);
  }

  async function createWorkspaceFile(name: string, content: string): Promise<void> {
    writeWorkspaceFile(name, content);
    await sleep(FS_EVENT_SETTLE_MS);
  }

  function newRecords(tool: FakeTool, known: Set<number>) {
    return readRecords(tool).filter((record) => !known.has(record.pid));
  }

  async function startServersWithKnownPids(): Promise<{ servers: ServerRecords; known: Set<number> }> {
    const servers = await startFakeServers(api);
    return { servers, known: new Set(readRecords().map((record) => record.pid)) };
  }

  // Waits for one new chpl-language-server to replace the old one, with chplcheck left alone
  async function expectClsRestart(servers: ServerRecords, known: Set<number>): Promise<void> {
    const oldPid = servers[CLS].pid;
    await waitFor(
      () => stateName(api.cls) === "RUNNING" && liveRecords(CLS).some((record) => !known.has(record.pid)),
      { timeout: RESTART_TIMEOUT_MS, message: "a new chpl-language-server" }
    ).catch((e) => {
      throw new Error(`${e.message} (state ${stateName(api.cls)}, old server alive: ${isAlive(oldPid)})`);
    });
    await waitFor(() => !isAlive(oldPid), { message: "the old chpl-language-server to exit" });
    await sleep(SETTLE_MS);

    assert.strictEqual(newRecords(CLS, known).length, 1, "chpl-language-server should restart exactly once");
    assert.strictEqual(newRecords("chplcheck", known).length, 0, "chplcheck should not restart");
    assert.ok(isAlive(servers.chplcheck.pid), "chplcheck should keep running");
    assert.strictEqual(stateName(api.cls), "RUNNING");
    assert.strictEqual(stateName(api.chplcheck), "RUNNING");
  }

  // The recursive file watcher can miss events until it has finished starting up.
  async function waitForRecursiveWatcher(): Promise<void> {
    const probe = path.join(folder, ".watcher-ready");
    const watcher = vscode.workspace.createFileSystemWatcher("**/.watcher-ready");
    let seen = false;
    watcher.onDidCreate(() => (seen = true));
    watcher.onDidChange(() => (seen = true));
    try {
      await waitFor(
        async () => {
          fs.writeFileSync(probe, String(Date.now()));
          await sleep(500);
          return seen;
        },
        { timeout: 30000, message: "the recursive file watcher to report events" }
      );
    } finally {
      watcher.dispose();
      fs.rmSync(probe, { force: true });
    }
  }

  before(async function () {
    api = await activateExtension();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("no workspace folder is open");
    }
    folder = workspaceFolder.uri.fsPath;
    try {
      await waitForRecursiveWatcher();
    } catch (e) {
      // VS Code itself is not delivering file events, so these tests cannot tell anything
      console.warn(`skipping file watcher tests: ${e}`);
      this.skip();
    }
  });

  beforeEach(() => {
    clearRecords();
  });

  afterEach(async () => {
    await resetLanguageClients(api);
    for (const file of created.splice(0)) {
      fs.rmSync(file, { force: true });
    }
    // Lets any restart queued by the removals fire while the clients are disabled
    await sleep(SETTLE_MS);
    clearRecords();
  });

  it("restarts chpl-language-server when .cls-commands.json changes", async () => {
    await createWorkspaceFile(".cls-commands.json", "[]\n");
    const { servers, known } = await startServersWithKnownPids();

    writeWorkspaceFile(".cls-commands.json", "[{\"file\": \"hello.chpl\"}]\n");
    await expectClsRestart(servers, known);
  });

  it("restarts chpl-language-server when Mason.toml changes", async () => {
    await createWorkspaceFile("Mason.toml", MASON_TOML);
    const { servers, known } = await startServersWithKnownPids();

    writeWorkspaceFile("Mason.toml", `${MASON_TOML}\n[dependencies]\n`);
    await expectClsRestart(servers, known);
  });

  it("restarts chpl-language-server when Mason.lock changes", async () => {
    await createWorkspaceFile("Mason.lock", "[root]\n");
    const { servers, known } = await startServersWithKnownPids();

    writeWorkspaceFile("Mason.lock", "[root]\nname = \"watched\"\n");
    await expectClsRestart(servers, known);
  });

  it("restarts chpl-language-server once for several rapid edits", async () => {
    writeWorkspaceFile(".cls-commands.json", "[]\n");
    await createWorkspaceFile("Mason.toml", MASON_TOML);
    const { servers, known } = await startServersWithKnownPids();

    for (let i = 0; i < 5; i++) {
      writeWorkspaceFile(i % 2 === 0 ? ".cls-commands.json" : "Mason.toml", `# edit ${i}\n`);
      await sleep(50);
    }
    await expectClsRestart(servers, known);
  });

  it("does not restart either server when an unrelated file changes", async () => {
    await createWorkspaceFile("notes.json", "[]\n");
    const { known } = await startServersWithKnownPids();

    writeWorkspaceFile("notes.json", "[1]\n");
    await sleep(SETTLE_MS * 2);
    assert.deepStrictEqual(newRecords("chplcheck", known), []);
    assert.deepStrictEqual(newRecords(CLS, known), []);
  });

  it.skip("restarts chpl-language-server when .cls-commands.json is created (#150)", async () => {
    const { servers, known } = await startServersWithKnownPids();

    writeWorkspaceFile(".cls-commands.json", "[]\n");
    await expectClsRestart(servers, known);
  });

  it.skip("restarts chpl-language-server when Mason.toml is created (#150)", async () => {
    const { servers, known } = await startServersWithKnownPids();

    writeWorkspaceFile("Mason.toml", MASON_TOML);
    await expectClsRestart(servers, known);
  });

  it.skip("restarts chpl-language-server when .cls-commands.json is deleted (#150)", async () => {
    await createWorkspaceFile(".cls-commands.json", "[]\n");
    const { servers, known } = await startServersWithKnownPids();

    fs.rmSync(path.join(folder, ".cls-commands.json"));
    await expectClsRestart(servers, known);
  });

  it.skip("restarts chpl-language-server when Mason.toml is deleted (#150)", async () => {
    await createWorkspaceFile("Mason.toml", MASON_TOML);
    const { servers, known } = await startServersWithKnownPids();

    fs.rmSync(path.join(folder, "Mason.toml"));
    await expectClsRestart(servers, known);
  });
});
