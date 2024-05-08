/*
 * Copyright 2024-2024 Hewlett Packard Enterprise Development LP
 * Other additional copyright holders may be indicated within.
 *
 * The entirety of this work is licensed under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 *
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";

export function checkChplHome(
  chplhome: string | undefined
): string | undefined {
  if (chplhome === undefined || chplhome === "") {
    return "CHPL_HOME is not set";
  }

  if (!fs.existsSync(chplhome) || !fs.statSync(chplhome).isDirectory()) {
    return `CHPL_HOME (${chplhome}) does not exist`;
  }

  if (!path.isAbsolute(chplhome)) {
    return `CHPL_HOME (${chplhome}) is not an absolute path`;
  }

  const subdirs = [
    "util",
    "compiler",
    "frontend",
    "runtime",
    "modules",
    "tools",
  ];
  let isChplDir = true;
  for (const subdir of subdirs) {
    const subdir_path = path.join(chplhome, subdir);
    if (
      !fs.existsSync(subdir_path) ||
      !fs.statSync(subdir_path).isDirectory()
    ) {
      isChplDir = false;
      break;
    }
  }
  if (!isChplDir) {
    return `CHPL_HOME (${chplhome}) is not a Chapel directory`;
  }

  return undefined;
}

export function checkToolPath(tool_path: string): string | undefined {
  if (!fs.existsSync(tool_path) || !fs.statSync(tool_path).isFile()) {
    return `${tool_path} does not exist`;
  }
  return undefined;
}

function searchDirectoryForChplHome(dir: string, depth: number = 1): string[] {
  let chplhomes: string[] = [];
  if (depth > 0) {
    if (checkChplHome(dir) === undefined) {
      chplhomes.push(dir);
    } else if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      try {
        // sadly this is the only way synchronous way to check if the directory is readable
        fs.accessSync(dir, fs.constants.R_OK);
      } catch(err) {
        return chplhomes;
      }
      fs.readdirSync(dir).forEach((subdir) => {
        const subdir_path = path.join(dir, subdir);
        chplhomes.push(...searchDirectoryForChplHome(subdir_path, depth - 1));
      });
    }
  }
  return chplhomes;
}

export function findPossibleChplHomes(): string[] {
  let possibleChplHomes: string[] = [];
  const chplhomeFromEnv = process.env["CHPL_HOME"];
  if (checkChplHome(chplhomeFromEnv) === undefined) {
    possibleChplHomes.push(chplhomeFromEnv as string);
  }

  // TODO: it would be nice to walk PATH and look for chpl
  // then we could execute `chpl --print-chpl-home` to get the chplhome
  // but we cannot execute shell commands and get their result with the vscode api

  // as a best effort, we find chpl in the PATH and check if chplhome is the parent directory
  const PATH = process.env["PATH"];
  const paths_to_check = PATH?.split(path.delimiter) ?? [];
  for (const p of paths_to_check) {
    const chpl_path = path.join(p, "chpl");
    if (fs.existsSync(chpl_path) && fs.statSync(chpl_path).isFile()) {
      const chplhome = path.dirname(path.dirname(chpl_path));
      if (
        checkChplHome(chplhome) === undefined &&
        possibleChplHomes.indexOf(chplhome) === -1
      ) {
        possibleChplHomes.push(chplhome);
      }
    }
  }
  // as a best effort, we can also check `/opt` and `/opt/homebrew/Cellar/chapel` for chplhome, searching to a depth of 3
  const dirs_to_check = ["/opt", "/opt/homebrew/Cellar/chapel/"];
  for (const dir of dirs_to_check) {
    possibleChplHomes.push(...new Set(searchDirectoryForChplHome(dir, 3)));
  }

  return possibleChplHomes;
}

export function cloneEnv() {
  interface Dict<T> {
    [k: string]: T;
  }
  let env: Dict<string> = {};
  for (const e in process.env) env[e] = process.env[e] ?? "";
  return env;
}

export function buildTools(chplhome: string) {
  let env = cloneEnv();
  const term = vscode.window.createTerminal({ cwd: chplhome, env: env });
  term.sendText(`make chpl-language-server || exit 1 && make chplcheck || exit 1 && exit 0`);
  term.show();
  vscode.window.onDidChangeTerminalState((e) => {
    if (e === term && e.exitStatus !== undefined) {
      if (e.exitStatus.code === 0) {
        vscode.window.showInformationMessage("Build complete");
        vscode.commands.executeCommand("chplcheck.restart");
        vscode.commands.executeCommand("chpl-language-server.restart");
      } else {
        vscode.window.showWarningMessage(`Build failed, try running 'export CHPL_HOME=${chplhome} && make chpl-language-server && make chplcheck' in the CHPL_HOME directory to see the error message.`);
      }
    }
  })
}
