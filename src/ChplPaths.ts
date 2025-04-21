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
import * as cfg from "./configuration";
import { showInvalidPathWarning } from "./extension";
import assert from "assert";

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

// take a callback to be called on each file found
// if the callback returns true, stop searching
function searchPATH(
  file: string,
  callback: (file_path: string) => boolean | void
) {
  const PATH = process.env["PATH"];
  const paths_to_check = PATH?.split(path.delimiter) ?? [];
  for (const p of paths_to_check) {
    const file_path = path.join(p, file);
    if (fs.existsSync(file_path) && fs.statSync(file_path).isFile()) {
      const r = callback(file_path);
      if (r !== undefined && r === true) {
        break;
      }
    }
  }
}

export function checkToolPath(tool_path: string): string | undefined {
  if (tool_path === "") {
    return "Path is empty";
  }
  if (!fs.existsSync(tool_path) || !fs.statSync(tool_path).isFile()) {
    return `${tool_path} does not exist`;
  }
  return undefined;
}

export function findToolPath(
  tool_name: string,
  chplhome: string | undefined
): string | undefined {
  assert(tool_name === "chplcheck" || tool_name === "chpl-language-server");

  // 1. if there is a path in config, use that.
  // 2. if there is a chplhome, use that
  // 3. otherwise, search PATH

  const cfg_tool_path =
    tool_name === "chplcheck"
      ? cfg.getChplCheckConfig().path
      : cfg.getCLSConfig().path;
  if (cfg_tool_path !== undefined && cfg_tool_path !== "") {
    return cfg_tool_path;
  }

  if (chplhome !== undefined && checkChplHome(chplhome) === undefined) {
    const tool_path = path.join(chplhome, "tools", tool_name, tool_name);
    const error = checkToolPath(tool_path);
    if (error === undefined) {
      return tool_path;
    }
  }

  let tool_path: string | undefined = undefined;
  searchPATH(tool_name, (file_path) => {
    tool_path = file_path;
    return true;
  });
  return tool_path;
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
      } catch (err) {
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
  searchPATH("chpl", (chpl_path) => {
    const chplhome = path.dirname(path.dirname(chpl_path));
    if (
      checkChplHome(chplhome) === undefined &&
      possibleChplHomes.indexOf(chplhome) === -1
    ) {
      possibleChplHomes.push(chplhome);
    }
  });
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

export function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return undefined;
  }
  const doc = editor.document;
  return vscode.workspace.getWorkspaceFolder(doc.uri);
}

export function getEnvAffectingChapel(): Map<string, string> {
  const globs = [
    "CHPL_.*",
    "CHPL_RT_.*",
    "FI_.*",
    "GASNET_.*",
    "SLURM_.*",
    "PBS_.*",
    "QTHREAD_.*",
    "QT_.*",
    "ASAN_OPTIONS",
  ];
  // TODO: consider including?
  // PKG_CONFIG_PATH
  // HUGETLB_NO_RESERVE
  // MASON_REGISTRY
  // SPACK_ROOT
  // PYTHON*
  // LD_LIBRARY_PATH
  // DYLD_LIBRARY_PATH
  const regex = new RegExp(`^(${globs.join('|')})$`)

  let env = new Map();
  for (const e in process.env) {
    if (regex.test(e)) {
      env.set(e, process.env[e] ?? "");
    }
  }

  // special handling for CHPL_HOME and CHPL_DEVELOPER
  const chplhome = cfg.getChplHome();
  if (chplhome != undefined && chplhome !== "") {
    env.set("CHPL_HOME", chplhome);
  } else if (process.env["CHPL_HOME"] !== undefined) {
    env.set("CHPL_HOME", process.env["CHPL_HOME"]);
  }
  const chpldev = cfg.getChplDeveloper();
  if (chpldev !== undefined && chpldev) {
    env.set("CHPL_DEVELOPER", "1");
  } else if (process.env["CHPL_DEVELOPER"] !== undefined) {
    env.set("CHPL_DEVELOPER", process.env["CHPL_DEVELOPER"]);
  }

  return env;

}
