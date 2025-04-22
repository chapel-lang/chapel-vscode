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
 *
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getDefaultChplCompiler, getEnvAffectingChapel } from './ChplPaths';
import { logger } from './extension';



// THIS MUST MATCH 'package.json'
interface ChplBuildTaskDefinition extends vscode.TaskDefinition {
  /* Use this compiler instead of the default one */
  compiler?: string;

  /* Not required, but if its provided it can be used an identifier for show a "Run" button on a file */
  rootFile?: string;

  /* Arguments to be passed */
  args?: string[];

  /* Environment variables to be passed */
  env?: { [key: string]: string };

  /* The current working directory to use for compiling files. If not specified, the project root is used. */
  cwd?: string;
}

interface ChplRunTaskDefinition extends vscode.TaskDefinition {
  /* the executable to run */
  executable: string;

  /* argument to be passed as `--numLocales=...`. If not specified, defaults to `--numLocales=1` */
  numLocales?: string;

  /* Not required, but if its provided it can be used an identifier for show a "Run" button on a file */
  rootFile?: string;

  /* Arguments to be passed */
  args?: string[];

  /* Environment variables to be passed */
  env?: { [key: string]: string };

  /* The current working directory to use for compiling files. If not specified, the project root is used. */
  cwd?: string;
}

const ChplBuildType = 'chpl';
const ChplRunType = 'chpl-run';
const ChplProblemMatcher = '$chpl-compiler';


function getBuildTaskFromDefinition(definition: ChplBuildTaskDefinition, oldTask?: vscode.Task): vscode.Task {

  const chplCompiler = definition.compiler || getDefaultChplCompiler();
  const args = definition.args || [];
  const cwd = definition.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  const env = getEnv(definition);

  const execution = new vscode.ProcessExecution(
    chplCompiler,
    args,
    {
      cwd: cwd,
      env: Object.fromEntries(env)
    }
  );
  const fileBaseName = definition.rootFile ? path.basename(definition.rootFile) : undefined;
  const name = oldTask?.name || fileBaseName ? `Compile ${fileBaseName}` : "Compile";

  const task = new vscode.Task(
    definition,
    oldTask?.scope || vscode.TaskScope.Workspace,
    name,
    ChplBuildType,
    execution,
    ChplProblemMatcher
  );
  task.group = vscode.TaskGroup.Build;
  logger.info(`Creating task: ${task.name} ${task.definition.type} ${JSON.stringify(task)}`);
  return task;
}

function getRunTaskFromDefinition(definition: ChplRunTaskDefinition, oldTask?: vscode.Task): vscode.Task {

  const executable = definition.executable;
  const numLocales = definition.numLocales || "1";
  const args = definition.args || [];
  const cwd = definition.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  const env = getEnv(definition);

  const execution = new vscode.ProcessExecution(
    executable,
    [`--numLocales=${numLocales}`, ...args],
    {
      cwd: cwd,
      env: Object.fromEntries(env)
    }
  );
  const name = oldTask?.name || `Run ${executable}`;

  const task = new vscode.Task(
    definition,
    oldTask?.scope || vscode.TaskScope.Workspace,
    name,
    ChplRunType,
    execution,
    []
  );
  return task;
}

async function getPerFileTasks(taskCreator: (filePath: string, fileName: string, outFile: string, cwd: string) => vscode.Task): Promise<vscode.Task[]> {
  return vscode.workspace.findFiles('**/*.chpl').then((fileUris) => {
    const tasks: vscode.Task[] = [];
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Create a task for each Chapel file
    for (const fileUri of fileUris) {
      const filePath = fileUri.fsPath;
      const fileName = path.basename(filePath);
      const outFile = fileName.replace(/\.chpl$/, '');
      const cwd = replaceAbsPath(wsPath, path.dirname(filePath));

      const task = taskCreator(filePath, fileName, outFile, cwd);
      tasks.push(task);
    }
    return tasks;
  })
}

class ChplBuildTaskProvider implements vscode.TaskProvider {
  private providePromise: Thenable<vscode.Task[]> | undefined = undefined;

  public provideTasks(): Thenable<vscode.Task[]> | undefined {
    if (!this.providePromise) {
      const createBuildTask = (filePath: string, _fileName: string, outFile: string, cwd: string) => {
        const buildTask = getBuildTaskFromDefinition({
          type: ChplBuildType,
          rootFile: filePath,
          args: [filePath, "-o", outFile],
          cwd: cwd,
          env: Object.fromEntries(getEnv())
        });
        return buildTask;
      }
      this.providePromise = getPerFileTasks(createBuildTask);
    }
    return this.providePromise;
  }

  public resolveTask(task: vscode.Task): vscode.Task | undefined {
    const definition = task.definition as ChplBuildTaskDefinition;
    if (definition) {
      const resolvedTask = getBuildTaskFromDefinition(definition, task);
      return resolvedTask;
    }
    return undefined
  }
}

class ChplRunTaskProvider implements vscode.TaskProvider {
  private providePromise: Thenable<vscode.Task[]> | undefined = undefined;

  public provideTasks(): Thenable<vscode.Task[]> | undefined {
    if (!this.providePromise) {
      const createRunTask = (_filePath: string, _fileName: string, outFile: string, cwd: string) => {
        const runTask = getRunTaskFromDefinition({
          type: ChplRunType,
          executable: outFile,
          numLocales: "1",
          cwd: cwd
        });
        return runTask;
      };
      this.providePromise = getPerFileTasks(createRunTask);
    }
    return this.providePromise;
  }

  public resolveTask(task: vscode.Task): vscode.Task | undefined {
    const definition = task.definition as ChplRunTaskDefinition;
    if (definition) {
      const resolvedTask = getRunTaskFromDefinition(definition, task);
      return resolvedTask;
    }
    return undefined
  }


}

async function chpl_runFileTask() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found.');
    return;
  }
  const document = editor.document;
  if (document.languageId !== 'chapel') {
    vscode.window.showErrorMessage('The current file is not a Chapel file.');
    return;
  }
  const filePath = document.fileName;

  const tasks =
    (await Promise.all([vscode.tasks.fetchTasks({
      type: ChplBuildType,
    }), vscode.tasks.fetchTasks({
      type: ChplRunType,
    })])).flat()
      .filter(task => {
        const definition = task.definition as ChplBuildTaskDefinition | ChplRunTaskDefinition;
        return definition.rootFile === filePath;
      });

  if (tasks.length === 0) {
    vscode.window.showErrorMessage('No tasks found for this file.');
    return;
  }
  const selectedTask = await vscode.window.showQuickPick(tasks.map(task => task.name), {
    placeHolder: 'Select a task to run',
  });
  if (!selectedTask) {
    return;
  }
  const task = tasks.find(t => t.name === selectedTask);
  if (!task) {
    vscode.window.showErrorMessage('Task not found.');
    return;
  }
  await vscode.tasks.executeTask(task);


}
export function registerChapelTaskProvider(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.tasks.registerTaskProvider(
    ChplRunType,
    new ChplRunTaskProvider()
  ));
  context.subscriptions.push(vscode.tasks.registerTaskProvider(
    ChplBuildType,
    new ChplBuildTaskProvider()
  ));

  context.subscriptions.push(
    vscode.commands.registerCommand('chapel.runFileTask', chpl_runFileTask));
}



function getEnv(def: ChplBuildTaskDefinition | ChplRunTaskDefinition | undefined = undefined): Map<string, string> {
  let envMap = def?.env ? new Map<string, string>(Object.entries(def.env)) : new Map<string, string>();
  const baseEnv = getEnvAffectingChapel(["PATH"]);
  // merge the base env with the user provided env, prefer user provided env
  for (const [key, value] of baseEnv) {
    if (!envMap.has(key)) {
      envMap.set(key, value);
    }
  }
  return envMap;
}

function replaceAbsPath(wsPath: string | undefined, filePath: string): string {
  if (wsPath && filePath.startsWith(`${wsPath}/`)) {
    return filePath.replace(wsPath, "${workspaceFolder}/");
  }
  return filePath;
}
