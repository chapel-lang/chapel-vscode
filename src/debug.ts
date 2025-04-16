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

export function registerDebugCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "chapel.generateGenericDebug",
      async () => {
        // determine the provider
        const provider = getPreferredProvider();
        if (!provider) {
          const preferredProviderId = getPreferredDebugProvider();
          vscode.window.showErrorMessage(`The requested debug provider ${preferredProviderId} is not installed/supported`);
          return;
        }

        if (!provider.isAvailable()) {
          vscode.window.showErrorMessage(`The requested debug provider ${provider.id} is not installed. Please install [${provider.name}](command:${provider.getInstallCommand()}) or select another provider.`);
          return;
        }

        // TODO: we could do some kind of detection for mason projects, maybe even Make/CMake?
        // TODO: for the executables, we could search for all executable files?
        // TODO create a custom webview to let the user select the executable and env vars and args
        // for now, prompt the user for a name and a path the executable

        const name = await vscode.window.showInputBox({ placeHolder: "Enter the name of the debug configuration" });
        if (!name) {
          return;
        }
        const executable = await vscode.window.showInputBox({ placeHolder: "Enter the path to the executable" });
        if (!executable) {
          return;
        }

        const newConfig = provider.createDebugConfig(name, executable);

        const launchConfigs = vscode.workspace.getConfiguration("launch");
        const configs = launchConfigs.get<any[]>("configurations") || [];
        const existingConfigIdx = configs.findIndex((config: any) => config.name === name);
        if (existingConfigIdx !== -1) {
          const choice = await vscode.window.showErrorMessage(`A debug configuration with the name ${name} already exists.`, "Cancel", "Overwrite");
          if (choice !== "Cancel") {
            configs[existingConfigIdx] = newConfig;
          }
        } else {
          configs.push(newConfig);
        }
        launchConfigs.update("configurations", configs).then(() => {
          vscode.window.showInformationMessage(`Debug configuration ${name} created successfully.`);
        }, (err) => {
          vscode.window.showErrorMessage(`Failed to create debug configuration: ${err}`);
        });
      }
    )
  );
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


// TODO: this is a placeholder for the webview panel
// class LaunchConfigCreationPanel {
// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
// }
