import * as assert from "assert";
import { execFileSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { ChapelLanguageClient } from "../../../src/ChapelLanguageClient";
import type { ChapelExtensionApi } from "../../../src/extension";
import { restoreSettings, setSetting } from "./settings";
import { waitFor } from "./wait";

// The language server can take tens of seconds to start for the first time.
export const SERVER_TIMEOUT = 120000;

// Mirrors LanguageClientState in src/ChapelLanguageClient.ts
export const ClientState = {
  DISABLED: 0,
  STOPPED: 1,
  STARTING: 2,
  RUNNING: 3,
  ERRORED: 4,
} as const;

export function findOnPath(tool: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(dir, tool);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return undefined;
}

export function skipWithoutChapel(ctx: Mocha.Context): void {
  if (findOnPath("chpl-language-server") === undefined) {
    ctx.skip();
  }
}

export function chplHome(): string {
  return execFileSync("chpl", ["--print-chpl-home"], { encoding: "utf8" })
    .trim()
    .split(/\s+/)[0];
}

export function clsVersion(): [number, number, number] {
  const output = execFileSync("chpl-language-server", ["--version"], {
    encoding: "utf8",
  });
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(output);
  assert.ok(match, `cannot parse version from '${output}'`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function clsAtLeast(major: number, minor: number): boolean {
  const [maj, min] = clsVersion();
  return maj > major || (maj === major && min >= minor);
}

export interface Violation {
  rule: string;
  line: number;
}

export function chplcheckCli(tool: string, file: string): Violation[] {
  const result = spawnSync(tool, [file], { encoding: "utf8" });
  const violations: Violation[] = [];
  for (const line of result.stdout.split("\n")) {
    const match = /:(\d+): node violates rule (\w+)/.exec(line);
    if (match) {
      violations.push({ rule: match[2], line: Number(match[1]) });
    }
  }
  return violations;
}

export function isLintDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  return diagnostic.message.startsWith("Lint:");
}

export function lintRule(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code;
  return String(typeof code === "object" ? code.value : code);
}

export function lintViolations(uri: vscode.Uri): Violation[] {
  return vscode.languages
    .getDiagnostics(uri)
    .filter(isLintDiagnostic)
    .map((d) => ({ rule: lintRule(d), line: d.range.start.line + 1 }));
}

export function workspaceUri(...segments: string[]): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "no workspace folder is open");
  return vscode.Uri.joinPath(folder.uri, ...segments);
}

export async function openDocument(
  ...segments: string[]
): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(workspaceUri(...segments));
  await vscode.window.showTextDocument(doc);
  return doc;
}

export function positionOf(
  doc: vscode.TextDocument,
  text: string,
  offset = 0
): vscode.Position {
  const index = doc.getText().indexOf(text);
  assert.ok(index >= 0, `'${text}' not found in ${doc.uri.fsPath}`);
  return doc.positionAt(index + offset);
}

export function waitForRunning(
  client: ChapelLanguageClient,
  timeout = SERVER_TIMEOUT
): Promise<true> {
  return waitFor(() => client.state === ClientState.RUNNING, {
    timeout,
    interval: 250,
    message: `${client.name} to be running (state ${client.state})`,
  });
}

export function waitForRestart(
  client: ChapelLanguageClient,
  previous: ChapelLanguageClient["client"],
  timeout = SERVER_TIMEOUT
): Promise<true> {
  return waitFor(
    () => client.client !== previous && client.state === ClientState.RUNNING,
    {
      timeout,
      interval: 250,
      message: `${client.name} to restart (state ${client.state})`,
    }
  );
}

export async function startServers(
  api: ChapelExtensionApi,
  ...segments: string[]
): Promise<vscode.TextDocument> {
  const doc = await openDocument(...segments);
  await Promise.all([waitForRunning(api.chplcheck), waitForRunning(api.cls)]);
  return doc;
}

// Changing settings while a client is still starting leaves a duplicate server behind.
async function reconfigure(
  api: ChapelExtensionApi,
  change: () => Promise<boolean>
): Promise<void> {
  const clients = [api.chplcheck, api.cls];
  await waitFor(
    () => clients.every((c) => c.state !== ClientState.STARTING),
    { timeout: SERVER_TIMEOUT, message: "servers to finish starting" }
  );
  const previous = clients.map((c) => c.client);
  if (!(await change())) {
    return;
  }
  const config = vscode.workspace.getConfiguration("chapel");
  const enabled = clients.map((c) =>
    config.get<boolean>(`${c.name}.enable`, true)
  );
  await waitFor(
    () =>
      clients.every((c, i) =>
        enabled[i]
          ? c.client !== previous[i] && c.state === ClientState.RUNNING
          : c.state === ClientState.DISABLED
      ),
    { timeout: SERVER_TIMEOUT, interval: 250, message: "servers to restart" }
  );
}

export function setSettingAndRestart(
  api: ChapelExtensionApi,
  key: string,
  value: unknown
): Promise<void> {
  return reconfigure(api, async () => {
    await setSetting(key, value);
    return true;
  });
}

export function restoreSettingsAndRestart(
  api: ChapelExtensionApi
): Promise<void> {
  return reconfigure(api, async () => (await restoreSettings()) > 0);
}
