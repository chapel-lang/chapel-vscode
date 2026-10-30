/*
 * Copyright 2024-2025 Hewlett Packard Enterprise Development LP
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

import * as vscode from "vscode";
import * as cfg from "./configuration";
import assert from "assert";
import { CHPL_WRAPPER, MASON_WRAPPER } from "./constants";
import { resolveToolPath } from "./util/chplHome";
import { computeEnvAffectingChapel } from "./util/env";

export { checkChplHome, checkToolPath, findPossibleChplHomes } from "./util/chplHome";

export function findToolPath(
  tool_name: string,
  chplhome: string | undefined
): string | undefined {
  assert(tool_name === "chplcheck" || tool_name === "chpl-language-server");

  const cfg_tool_path =
    tool_name === "chplcheck"
      ? cfg.getChplCheckConfig().path
      : cfg.getCLSConfig().path;
  return resolveToolPath(tool_name, cfg_tool_path, chplhome);
}

export function cloneEnv() {
  interface Dict<T> {
    [k: string]: T;
  }
  let env: Dict<string> = {};
  for (const e in process.env) {
    env[e] = process.env[e] ?? "";
  }
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

/*
  Gets all of the environment variables that could possibly affect Chapel
  execution. This can be used to prepopulated configuration files for users or\to forward on the custom sub-processes.
*/
export function getEnvAffectingChapel(extra_globs?: string[]): Map<string, string> {
  return computeEnvAffectingChapel(
    process.env,
    {
      chplHome: cfg.getChplHome(),
      chplDeveloper: cfg.getChplDeveloper(),
      baseEnv: cfg.getBaseEnv(),
    },
    extra_globs
  );
}

export function getDefaultChplCompiler(): string {
  const compiler = cfg.getDefaultCompiler();
  if (compiler !== undefined && compiler !== "") {
    return compiler;
  } else {
    return CHPL_WRAPPER;
  }
}

export function getDefaultMason(): string {
  const mason = cfg.getDefaultMason();
  if (mason !== undefined && mason !== "") {
    return mason;
  } else {
    return MASON_WRAPPER;
  }
}
