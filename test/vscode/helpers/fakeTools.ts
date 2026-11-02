import * as fs from "fs";
import * as path from "path";
import { getExtension } from "./api";

export type FakeTool = "chplcheck" | "chpl-language-server";
export const FAKE_TOOLS: readonly FakeTool[] = ["chplcheck", "chpl-language-server"];

export interface FakeServerRecord {
  tool: FakeTool;
  pid: number;
  argv: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}

export function fakeToolsDir(): string {
  return path.join(getExtension().extensionPath, "test", "fixtures", "fake-tools");
}

export function fakeToolPath(tool: FakeTool): string {
  return path.join(fakeToolsDir(), tool);
}

export function fakeChplHome(): string {
  return path.join(fakeToolsDir(), "fake-chpl-home");
}

export function fakeChplHomeToolPath(tool: FakeTool): string {
  return path.join(fakeChplHome(), "tools", tool, tool);
}

function recordDir(): string {
  const dir = process.env.FAKE_LSP_RECORD_DIR;
  if (!dir) {
    throw new Error("FAKE_LSP_RECORD_DIR is not set (see .vscode-test.mjs)");
  }
  return dir;
}

export function readRecords(tool?: FakeTool): FakeServerRecord[] {
  const dir = recordDir();
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as FakeServerRecord)
    .filter((record) => tool === undefined || record.tool === tool);
}

export function clearRecords(): void {
  const dir = recordDir();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function liveRecords(tool?: FakeTool): FakeServerRecord[] {
  return readRecords(tool).filter((record) => isAlive(record.pid));
}

export function killFakeServers(): number[] {
  const pids = liveRecords().map((record) => record.pid);
  for (const pid of pids) {
    process.kill(pid, "SIGKILL");
  }
  return pids;
}
