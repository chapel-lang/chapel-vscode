import * as vscode from "vscode";
import type { ChapelLanguageClient } from "../../../src/ChapelLanguageClient";
import type { ChapelExtensionApi } from "../../../src/extension";
import {
  FAKE_TOOLS,
  FakeServerRecord,
  FakeTool,
  clearRecords,
  fakeToolPath,
  killFakeServers,
  liveRecords,
} from "./fakeTools";
import { restoreSettings, setSetting } from "./settings";
import { sleep, waitFor } from "./wait";

// Mirrors LanguageClientState, which cannot be imported at runtime
const STATE_NAMES = ["DISABLED", "STOPPED", "STARTING", "RUNNING", "ERRORED"];

// Longer than CHAPEL_VSCODE_RESTART_DEBOUNCE_MS so a queued restart has fired
export const SETTLE_MS = 600;

export type ServerRecords = Record<FakeTool, FakeServerRecord>;

export function clientFor(api: ChapelExtensionApi, tool: FakeTool): ChapelLanguageClient {
  return tool === "chplcheck" ? api.chplcheck : api.cls;
}

export function stateName(client: ChapelLanguageClient): string {
  return STATE_NAMES[client.state];
}

// StatusBarItem has no public visibility getter, so record show()/hide() calls
const statusBarVisible = new WeakMap<vscode.StatusBarItem, boolean>();

export function trackStatusBar(client: ChapelLanguageClient): void {
  const item = client.statusBarItem;
  if (statusBarVisible.has(item)) {
    return;
  }
  statusBarVisible.set(item, false);
  const show = item.show.bind(item);
  const hide = item.hide.bind(item);
  item.show = () => {
    statusBarVisible.set(item, true);
    show();
  };
  item.hide = () => {
    statusBarVisible.set(item, false);
    hide();
  };
}

export function isStatusBarVisible(client: ChapelLanguageClient): boolean {
  const visible = statusBarVisible.get(client.statusBarItem);
  if (visible === undefined) {
    throw new Error(`status bar of ${client.name} is not tracked`);
  }
  return visible;
}

const originalEnv = new Map<string, string | undefined>();

// The tests share the extension host process, so this also changes the env servers inherit
export function setProcessEnv(key: string, value: string | undefined): void {
  if (!originalEnv.has(key)) {
    originalEnv.set(key, process.env[key]);
  }
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function restoreProcessEnv(): void {
  for (const [key, value] of originalEnv) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  originalEnv.clear();
}

export async function applySettings(settings: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await setSetting(key, value);
  }
}

export function fakeServerSettings(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "chplcheck.enable": true,
    "chplcheck.path": fakeToolPath("chplcheck"),
    "chpl-language-server.enable": true,
    "chpl-language-server.path": fakeToolPath("chpl-language-server"),
    ...extra,
  };
}

function runningServers(api: ChapelExtensionApi, exclude: Set<number>): ServerRecords | undefined {
  const result: Partial<ServerRecords> = {};
  for (const tool of FAKE_TOOLS) {
    const live = liveRecords(tool);
    if (stateName(clientFor(api, tool)) !== "RUNNING" || live.length !== 1 || exclude.has(live[0].pid)) {
      return undefined;
    }
    result[tool] = live[0];
  }
  return result as ServerRecords;
}

// Waits until each client is RUNNING with exactly one live server whose pid is not in `exclude`
export async function waitForServers(
  api: ChapelExtensionApi,
  exclude: Iterable<number> = []
): Promise<ServerRecords> {
  const excluded = new Set(exclude);
  const message = "one running fake server per tool";
  await waitFor(() => runningServers(api, excluded), { message });
  await sleep(SETTLE_MS);
  return waitFor(() => runningServers(api, excluded), { message });
}

export async function startFakeServers(
  api: ChapelExtensionApi,
  extra: Record<string, unknown> = {}
): Promise<ServerRecords> {
  await applySettings(fakeServerSettings(extra));
  return waitForServers(api);
}

export function pidsOf(servers: ServerRecords): number[] {
  return FAKE_TOOLS.map((tool) => servers[tool].pid);
}

export async function openHello(): Promise<vscode.TextDocument> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("no workspace folder is open");
  }
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "hello.chpl"));
  await vscode.window.showTextDocument(doc);
  return doc;
}

// Restores settings and env, waits for the clients to go back to DISABLED and kills leftover servers
export async function resetLanguageClients(api: ChapelExtensionApi): Promise<void> {
  const allDisabled = () => FAKE_TOOLS.every((tool) => stateName(clientFor(api, tool)) === "DISABLED");
  restoreProcessEnv();
  await restoreSettings();
  await sleep(SETTLE_MS);
  if (!allDisabled()) {
    // Restoring may not have changed any setting, so force a config reload
    await setSetting("baseEnv", { "TEST_RESET": "1" });
    await restoreSettings();
    await sleep(SETTLE_MS);
  }
  await waitFor(allDisabled, { message: "clients to be disabled after restoring settings" });
  try {
    await waitFor(() => liveRecords().length === 0, { timeout: 5000 });
  } catch {
    console.warn(`killed leftover fake servers: ${killFakeServers().join(", ")}`);
  }
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  clearRecords();
}
