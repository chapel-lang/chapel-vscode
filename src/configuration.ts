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

import * as vscode from "vscode";

export interface ToolConfig {
  args: Array<string>;
  enable: boolean;
  path: string | undefined;
}
const ToolConfigDefault: ToolConfig = {args: [], enable: false, path: undefined};

export type ChplCheckConfig = ToolConfig;
const ChplCheckConfigDefault: ChplCheckConfig = {...ToolConfigDefault };

export interface CLSConfig extends ToolConfig {
  resolver: boolean;
}
const CLSConfigDefault: CLSConfig = {...ToolConfigDefault, resolver: false};

const configScope = "chapel";

export function getChplHome(): string | undefined {
  const config = vscode.workspace.getConfiguration(configScope);
  const chplhome = config.get<string>("CHPL_HOME");
  return chplhome ?? undefined;
}
export function setChplHome(chplhome: string) {
  const config = vscode.workspace.getConfiguration(configScope);

  // an unfortunate aspect of the vscode API is that it doesn't allow us to
  // distinguish between global local and global remote settings. This means
  // this code may edit the wrong config file, because it will prefer the
  // global local settings over the global remote settings. This is a known
  // issue with the vscode API:
  // https://github.com/microsoft/vscode/issues/182696
  if(config.inspect("CHPL_HOME")?.workspaceValue !== undefined) {
    config.update("CHPL_HOME", chplhome, vscode.ConfigurationTarget.Workspace);
  } else {
    config.update("CHPL_HOME", chplhome, vscode.ConfigurationTarget.Global);
  }
}
export function getChplDeveloper(): boolean {
  const config = vscode.workspace.getConfiguration("chapel");
  const devel = config.get<boolean>("CHPL_DEVELOPER");
  return devel ?? false;
}

export function getChplCheckConfig(): ChplCheckConfig {
  const config = vscode.workspace.getConfiguration(configScope);
  const chplcheck = config.get<ChplCheckConfig>("chplcheck") ?? ChplCheckConfigDefault;
  return chplcheck;
}

export function getCLSConfig(): CLSConfig {
  const config = vscode.workspace.getConfiguration(configScope);
  const cls = config.get<CLSConfig>("chpl-language-server") ?? CLSConfigDefault;
  return cls;
}
