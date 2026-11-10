import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface ProcessInfo {
  pid: number;
  ppid: number;
  args: string;
}

export function listProcesses(): ProcessInfo[] {
  const output = execFileSync("ps", ["-ww", "-eo", "pid=,ppid=,args="], {
    encoding: "utf8",
  });
  const processes: ProcessInfo[] = [];
  for (const line of output.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (match) {
      processes.push({
        pid: Number(match[1]),
        ppid: Number(match[2]),
        args: match[3],
      });
    }
  }
  return processes;
}

export function descendantsOf(
  rootPid: number,
  processes: ProcessInfo[] = listProcesses()
): ProcessInfo[] {
  const pids = new Set([rootPid]);
  const result: ProcessInfo[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const proc of processes) {
      if (pids.has(proc.ppid) && !pids.has(proc.pid)) {
        pids.add(proc.pid);
        result.push(proc);
        added = true;
      }
    }
  }
  return result;
}

// Wrapper scripts exec into e.g. `python .../chplcheck.py`, so match the basename of any argument.
export function runsTool(proc: ProcessInfo, tool: string): boolean {
  const name = path.basename(tool);
  return proc.args
    .split(/\s+/)
    .map((arg) => path.basename(arg))
    .some((base) => base === name || base === `${name}.py`);
}

// Only processes started by this extension host, so other VS Code windows are ignored.
export function toolProcesses(tool: string): ProcessInfo[] {
  return descendantsOf(process.pid).filter((proc) => runsTool(proc, tool));
}

export function countToolProcesses(tool: string): number {
  return toolProcesses(tool).length;
}

export function processEnvironment(pid: number): string[] {
  if (process.platform === "linux") {
    return fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
  }
  // macOS appends the environment to the command line with `ps -E`
  const output = execFileSync(
    "ps",
    ["-E", "-ww", "-o", "command=", "-p", String(pid)],
    { encoding: "utf8" }
  );
  return output.trim().split(/\s+/);
}
