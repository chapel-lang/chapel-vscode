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
}
const ToolConfigDefault: ToolConfig = {args: [], enable: false};

export type ChplCheckConfig = ToolConfig;
const ChplCheckConfigDefault: ChplCheckConfig = {...ToolConfigDefault };

export interface CLSConfig extends ToolConfig {
  resolver: boolean;
}
const CLSConfigDefault: CLSConfig = {...ToolConfigDefault, resolver: false};

const configScope = "chapel";

export function getChplHome(): string {
  const config = vscode.workspace.getConfiguration(configScope);
  const chplhome = config.get<string>("CHPL_HOME");
  return chplhome ?? "";
}
export function setChplHome(chplhome: string) {
  const config = vscode.workspace.getConfiguration(configScope);

  // when updating CHPL_HOME, we should update the workspace config if its been overriden, otherwise set it globally for all users
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
