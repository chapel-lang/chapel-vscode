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


import * as vscode from 'vscode';
import { getPreferredDebugProvider } from './configuration';
import { getEnvAffectingChapel } from './ChplPaths';

export function registerDebugCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "chapel.createDebugConfig",
      chapel_createDebugConfig
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "chapel.createDebugConfigForActiveFile",
      chapel_createDebugConfigForActiveFile
    )
  );
}
async function chapel_createDebugConfig() {
  const provider = getProvider();
  if (!provider) {
    return
  }
  // TODO: we could do some kind of detection for mason projects, maybe even Make/CMake?

  const name = await vscode.window.showInputBox({ placeHolder: "Enter the name of the debug configuration" });
  if (!name) {
    return;
  }
  const executable = await vscode.window.showInputBox({ placeHolder: "Enter the path to the executable" });
  if (!executable) {
    return;
  }
  const { argsArray, envMap } = await getArgsAndEnv();

  const newConfig = provider.createDebugConfig(name, executable, argsArray, envMap);
  await saveConfig(newConfig);
}

async function chapel_createDebugConfigForActiveFile() {
  const provider = getProvider();
  if (!provider) {
    return
  }

  // get the current file
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }
  const document = editor.document;
  if (document.languageId !== "chapel") {
    vscode.window.showErrorMessage("The current file is not a Chapel file.");
    return;
  }
  const executablePath = document.fileName?.split(".").slice(0, -1).join(".");
  if (!executablePath) {
    vscode.window.showErrorMessage("Failed to get the file name.");
    return;
  }
  const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsPath) {
    vscode.window.showErrorMessage("No workspace folder found.");
  }
  let executableNiceName: string = executablePath.split("/").pop() || executablePath;
  let executableRelPath: string = executablePath;
  if (wsPath) {
    // determine executableRelPath to wsPath
    executableNiceName = executablePath.replace(wsPath + "/", "");
    executableRelPath = "${workspaceFolder}/" + executableNiceName;
  }

  const { argsArray, envMap } = await getArgsAndEnv();

  const newConfig = provider.createDebugConfig(`Debug ${executableNiceName}`, executableRelPath, argsArray, envMap);
  await saveConfig(newConfig);
}


function getProvider(): DebugProvider | undefined {
  // determine the provider
  const provider = getPreferredProvider();
  if (!provider) {
    const preferredProviderId = getPreferredDebugProvider();
    vscode.window.showErrorMessage(`The requested debug provider '${preferredProviderId}' is not installed/supported`);
    return;
  }

  if (!provider.isAvailable()) {
    vscode.window.showErrorMessage(`The requested debug provider '${provider.id}' is not installed. Please install [${provider.name}](command:${provider.getInstallCommand()}) or select another provider.`);
    return;
  }
  return provider;
}

async function saveConfig(newConfig: vscode.DebugConfiguration) {
  const name = newConfig.name;
  const launchConfigs = vscode.workspace.getConfiguration("launch");
  const configs = launchConfigs.get<any[]>("configurations") || [];
  const existingConfigIdx = configs.findIndex((config: any) => config.name === name);
  if (existingConfigIdx !== -1) {
    const choice = await vscode.window.showErrorMessage(`A debug configuration named '${name}' already exists.`, "Cancel", "Overwrite");
    if (choice !== "Cancel") {
      configs[existingConfigIdx] = newConfig;
    }
  } else {
    configs.push(newConfig);
  }
  launchConfigs.update("configurations", configs).then(() => {
    vscode.window.showInformationMessage(`Debug configuration '${name}' created successfully.`);
  }, (err) => {
    vscode.window.showErrorMessage(`Failed to create debug configuration: ${err}`);
  });
}

async function getArgsAndEnv() {

  // TODO: do some kind of shlex.split() on a comma, right now this will split
  // on commas inside of quotes

  const args = await vscode.window.showInputBox({ placeHolder: "Enter the arguments to pass to the executable (comma separated)" });
  const argsArray = args ? args.split(",").map((arg: string) => arg.trim()) : [];

  const env = await vscode.window.showInputBox({ placeHolder: "Enter the environment variables to set (key=value, comma separated)" });
  const envMap = new Map<string, string>();
  if (env) {
    const envArray = env.split(",").map((envVar: string) => envVar.trim());
    for (const envVar of envArray) {
      const [key, value] = envVar.split("=");
      if (key && value) {
        envMap.set(key.trim(), value.trim());
      }
    }
  }

  const baseEnv = getEnvAffectingChapel();
  // merge the base env with the user provided env, prefer user provided env
  for (const [key, value] of baseEnv) {
    if (!envMap.has(key)) {
      envMap.set(key, value);
    }
  }

  return { argsArray, envMap };
}

class DebugProvider {
  name: string;
  id: string;
  type: string;
  constructor(name: string, id: string, type: string) {
    this.name = name;
    this.id = id;
    this.type = type;
  }
  getInstallCommand(): string {
    return `extension.open?${encodeURIComponent(`"${this.id}"`)}`;
  }
  isAvailable(): boolean {
    const extension = vscode.extensions.getExtension(this.id);
    return extension !== undefined;
  }
  createDebugConfig(name: string, executable: string, args: string[] = [], env: Map<string, string> = new Map()): vscode.DebugConfiguration {
    return {
      name: name,
      type: this.type,
      request: "launch",
      program: executable,
      cwd: "${workspaceFolder}",
      args: args,
      env: Object.fromEntries(env),
      sourceLanguages: ["chapel"],
    };
  }
}

const debugProviders: Map<string, DebugProvider> = new Map([
  ["vadimcn.vscode-lldb", new DebugProvider("CodeLLDB", "vadimcn.vscode-lldb", "lldb")],
])


// currently unused
function getAvailableProviders(): DebugProvider[] {
  const availableProviders: DebugProvider[] = [];
  for (const provider of debugProviders.values()) {
    if (provider.isAvailable()) {
      availableProviders.push(provider);
    }
  }
  return availableProviders;
}
function getPreferredProvider(): DebugProvider | undefined {
  const preferredProviderId = getPreferredDebugProvider();
  if (preferredProviderId) {
    const provider = debugProviders.get(preferredProviderId);
    return provider;
  }
  return undefined;
}
