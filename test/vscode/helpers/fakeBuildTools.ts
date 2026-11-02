import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { fakeToolsDir } from "./fakeTools";

export type FakeBuildTool = "chpl" | "mason" | "run";

export interface FakeBuildRecord {
  tool: FakeBuildTool;
  argv: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  // Only for "run": the path of the program and the sources it was built from
  exe?: string;
  build?: string;
}

export const TASK_TIMEOUT_MS = 20000;

export function fakeChplPath(): string {
  return path.join(fakeToolsDir(), "chpl");
}

export function fakeMasonPath(): string {
  return path.join(fakeToolsDir(), "mason");
}

export function fakeProgramPath(): string {
  return path.join(fakeToolsDir(), "fake-program");
}

function recordDir(): string {
  const dir = process.env.FAKE_TOOL_RECORD_DIR;
  if (!dir) {
    throw new Error("FAKE_TOOL_RECORD_DIR is not set (see .vscode-test.mjs)");
  }
  return dir;
}

export function readBuildRecords(tool: FakeBuildTool): FakeBuildRecord[] {
  const file = path.join(recordDir(), `${tool}.jsonl`);
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as FakeBuildRecord);
}

export function clearBuildRecords(): void {
  const dir = recordDir();
  for (const tool of ["chpl", "mason", "run"]) {
    fs.rmSync(path.join(dir, `${tool}.jsonl`), { force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

export interface TaskEnd {
  task: vscode.Task;
  exitCode: number | undefined;
}

// Starts a task through `start` and resolves when the first process of a matching task ends.
export function waitForTaskEnd(
  match: (task: vscode.Task) => boolean,
  start: () => Thenable<unknown>,
  timeout = TASK_TIMEOUT_MS
): Promise<TaskEnd> {
  return new Promise<TaskEnd>((resolve, reject) => {
    const timer = setTimeout(() => {
      listener.dispose();
      reject(new Error(`Timed out after ${timeout}ms waiting for a task to end`));
    }, timeout);
    const listener = vscode.tasks.onDidEndTaskProcess((e) => {
      if (match(e.execution.task)) {
        clearTimeout(timer);
        listener.dispose();
        resolve({ task: e.execution.task, exitCode: e.exitCode });
      }
    });
    Promise.resolve(start()).catch((e) => {
      clearTimeout(timer);
      listener.dispose();
      reject(e);
    });
  });
}

export async function runTask(task: vscode.Task, timeout = TASK_TIMEOUT_MS): Promise<number | undefined> {
  const end = await waitForTaskEnd(
    (t) => t.name === task.name && t.definition.type === task.definition.type,
    () => vscode.tasks.executeTask(task),
    timeout
  );
  return end.exitCode;
}
