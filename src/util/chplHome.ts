/*
 * Copyright 2024-2026 Hewlett Packard Enterprise Development LP
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
export function searchPATH(
  file: string,
  callback: (file_path: string) => boolean | void,
  pathEnv: string | undefined = process.env["PATH"]
) {
  const paths_to_check = pathEnv?.split(path.delimiter) ?? [];
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

export function resolveToolPath(
  toolName: string,
  configuredPath: string | undefined,
  chplhome: string | undefined,
  pathEnv: string | undefined = process.env["PATH"]
): string | undefined {
  // 1. if there is a path in config, use that.
  // 2. if there is a chplhome, use that
  // 3. otherwise, search PATH

  if (configuredPath !== undefined && configuredPath !== "") {
    return configuredPath;
  }

  if (chplhome !== undefined && checkChplHome(chplhome) === undefined) {
    const tool_path = path.join(chplhome, "tools", toolName, toolName);
    const error = checkToolPath(tool_path);
    if (error === undefined) {
      return tool_path;
    }
  }

  let tool_path: string | undefined = undefined;
  searchPATH(toolName, (file_path) => {
    tool_path = file_path;
    return true;
  }, pathEnv);
  return tool_path;
}

export function searchDirectoryForChplHome(dir: string, depth: number = 1): string[] {
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

export function chplHomeFromChplPath(chplPath: string): string {
  return path.dirname(path.dirname(chplPath));
}

export function findPossibleChplHomes(
  env: NodeJS.ProcessEnv = process.env,
  dirsToCheck: string[] = ["/opt", "/opt/homebrew/Cellar/chapel/"]
): string[] {
  let possibleChplHomes: string[] = [];
  const chplhomeFromEnv = env["CHPL_HOME"];
  if (checkChplHome(chplhomeFromEnv) === undefined) {
    possibleChplHomes.push(chplhomeFromEnv as string);
  }

  // TODO: it would be nice to walk PATH and look for chpl
  // then we could execute `chpl --print-chpl-home` to get the chplhome
  // but we cannot execute shell commands and get their result with the vscode api

  // as a best effort, we find chpl in the PATH and check if chplhome is the parent directory
  searchPATH("chpl", (chpl_path) => {
    const chplhome = chplHomeFromChplPath(chpl_path);
    if (
      checkChplHome(chplhome) === undefined &&
      possibleChplHomes.indexOf(chplhome) === -1
    ) {
      possibleChplHomes.push(chplhome);
    }
  }, env["PATH"]);
  // as a best effort, we can also check `/opt` and `/opt/homebrew/Cellar/chapel` for chplhome, searching to a depth of 3
  for (const dir of dirsToCheck) {
    possibleChplHomes.push(...new Set(searchDirectoryForChplHome(dir, 3)));
  }

  return possibleChplHomes;
}
