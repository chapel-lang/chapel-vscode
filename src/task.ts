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

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getDefaultChplCompiler, getEnvAffectingChapel, getDefaultMason } from "./ChplPaths";
import { logger } from "./extension";



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


type MasonCommand = "build" | "test" | "run";

interface MasonTaskDefinition extends vscode.TaskDefinition {
  /* the path to mason, instead of the default  */
  mason?: string;

  /* which mason command will run */
  command: MasonCommand;

  /* Arguments to be passed */
  args?: string[];

  /* Environment variables to be passed */
  env?: { [key: string]: string };

  /* The current working directory to use for compiling files. If not specified, the project root is used. */
  cwd?: string;
}



const ChplBuildType = "chpl";
// TODO: do we really need a special chpl-run? Why not just a normal 'process' task?
// the only advantage this adds right now is the rootFile and numLocales properties
const ChplRunType = "chpl-run";
const MasonType = "mason";
const ChplProblemMatcher = "$chpl-compiler";


function getBuildTaskFromDefinition(definition: ChplBuildTaskDefinition, oldTask?: vscode.Task): vscode.Task {

  const chplCompiler = definition.compiler || getDefaultChplCompiler();
  const args = definition.args || [];
  const cwd = definition.cwd || getWorkspaceFolder() || process.cwd();

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
  const name = oldTask?.name || (fileBaseName ? `Compile ${fileBaseName}` : "Compile");

  const task = new vscode.Task(
    definition,
    oldTask?.scope || vscode.TaskScope.Workspace,
    name,
    ChplBuildType,
    execution,
    ChplProblemMatcher
  );
  task.group = vscode.TaskGroup.Build;
  return task;
}

function getRunTaskFromDefinition(definition: ChplRunTaskDefinition, oldTask?: vscode.Task): vscode.Task {

  const executable = definition.executable;
  const numLocales = definition.numLocales || "1";
  const args = definition.args || [];
  const cwd = definition.cwd || getWorkspaceFolder() || process.cwd();
  const env = getEnv(definition);

  const execution = new vscode.ProcessExecution(
    executable,
    [`--numLocales=${numLocales}`, ...args],
    {
      cwd: cwd,
      env: Object.fromEntries(env)
    }
  );
  const executableBaseName = path.basename(executable);
  const name = oldTask?.name || `Run ${executableBaseName}`;

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

function getMasonTaskFromDefinition(definition: MasonTaskDefinition, oldTask?: vscode.Task): vscode.Task {

  const mason = definition.mason || getDefaultMason();
  const command = definition.command;
  const args = definition.args || [];
  const cwd = definition.cwd || getWorkspaceFolder() || process.cwd();
  const env = getEnv(definition);

  const execution = new vscode.ProcessExecution(
    mason,
    [command, ...args],
    {
      cwd: cwd,
      env: Object.fromEntries(env)
    }
  );
  const name = oldTask?.name || `mason ${command}`;

  // TODO: can we use a problem matcher here?
  // either custom ones or the default chpl-compiler one?

  const task = new vscode.Task(
    definition,
    oldTask?.scope || vscode.TaskScope.Workspace,
    name,
    MasonType,
    execution,
    []
  );
  return task;
}

async function getPerFileTasks(taskCreator: (filePath: string, outFile: string, cwd: string) => vscode.Task): Promise<vscode.Task[]> {
  return vscode.workspace.findFiles("**/*.chpl").then((fileUris) => {
    const tasks: vscode.Task[] = [];
    const wsPath = getWorkspaceFolder();

    // Create a task for each Chapel file
    for (const fileUri of fileUris) {
      const filePath = path.resolve(fileUri.fsPath);
      const outFile = filePath.replace(/\.chpl$/, "");
      const cwd = path.dirname(filePath);

      const task = taskCreator(replaceWithWorkspaceFolder(wsPath, filePath), replaceWithWorkspaceFolder(wsPath, outFile), replaceWithWorkspaceFolder(wsPath, cwd));
      tasks.push(task);
    }
    return tasks;
  });
}

class ChplBuildTaskProvider implements vscode.TaskProvider {
  private providePromise: Thenable<vscode.Task[]> | undefined = undefined;

  public provideTasks(): Thenable<vscode.Task[]> | undefined {
    if (!this.providePromise) {
      const createBuildTask = (filePath: string, outFile: string, cwd: string) => {
        const buildTask = getBuildTaskFromDefinition({
          type: ChplBuildType,
          rootFile: filePath,
          args: [filePath, "-o", outFile],
          cwd: cwd,
          env: Object.fromEntries(getEnv())
        });
        return buildTask;
      };
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
    return undefined;
  }
}

class ChplRunTaskProvider implements vscode.TaskProvider {
  private providePromise: Thenable<vscode.Task[]> | undefined = undefined;

  public provideTasks(): Thenable<vscode.Task[]> | undefined {
    if (!this.providePromise) {
      const createRunTask = (filePath: string, outFile: string, cwd: string) => {
        const runTask = getRunTaskFromDefinition({
          type: ChplRunType,
          rootFile: filePath,
          executable: outFile,
          numLocales: "1",
          cwd: cwd,
          args: [],
          env: Object.fromEntries(getEnv())
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
    return undefined;
  }
}

  async function InvokeTestFileTask(filename: string, filter: string | undefined = undefined, masonFile: string | undefined = undefined) {
    if (!masonFile) {
      masonFile = path.join(getWorkspaceFolder() || process.cwd(), "Mason.toml");
    }
    // if it exists, use the mason file to determine the right directory
    const cwd = (fs.existsSync(masonFile)) ? path.dirname(masonFile) : (getWorkspaceFolder() || process.cwd());

    const args: string[] = ["--show"];
    if (filter) {
      args.push(`--filter=${filter}`);
    }
    args.push("--");
    args.push(filename);

    const masonEnv = MasonTaskProvider.GetMasonEnv();
    const definition: MasonTaskDefinition = {
      type: MasonType,
      command: "test",
      args: args,
      cwd: cwd,
      env: Object.fromEntries(masonEnv),
    };
    const task = getMasonTaskFromDefinition(definition);
    await vscode.tasks.executeTask(task);
  }

class MasonTaskProvider implements vscode.TaskProvider {
  private providePromise: Thenable<vscode.Task[]> | undefined = undefined;

  public static GetMasonEnv(): Map<string, string> {
    const env = getEnv();
    // make sure the default compiler is first in the PATH
    const chplCompiler = getDefaultChplCompiler();
    if (chplCompiler) {
      env.set("PATH", `${path.dirname(chplCompiler)}:${env.get("PATH") || ""}`);
    }
    return env;
  }

  public static CreateMasonTask(
    command: MasonCommand,
    args: string[] = [],
    masonFile: string | undefined = undefined): vscode.Task | undefined {
    if (!masonFile) {
      masonFile = path.join(getWorkspaceFolder() || "", "Mason.toml");
    }
    if (!fs.existsSync(masonFile)) {
      return undefined;
    }
    const cwd = path.dirname(masonFile);

    const definition: MasonTaskDefinition = {
      type: MasonType,
      command: command,
      args: args,
      cwd: cwd,
      env: Object.fromEntries(MasonTaskProvider.GetMasonEnv()),
    };
    return getMasonTaskFromDefinition(definition);
  }

  public provideTasks(): Thenable<vscode.Task[]> | undefined {
    if (!this.providePromise) {
      this.providePromise = new Promise((resolve, _) => {
        resolve([
          MasonTaskProvider.CreateMasonTask("build"),
          MasonTaskProvider.CreateMasonTask("test"),
          MasonTaskProvider.CreateMasonTask("run", ["--build"]),
        ].filter(task => task !== undefined) as vscode.Task[]);
      });
    }
    return this.providePromise;
  }

  public resolveTask(task: vscode.Task): vscode.Task | undefined {
    const definition = task.definition as MasonTaskDefinition;
    if (definition) {
      const resolvedTask = getMasonTaskFromDefinition(definition, task);
      return resolvedTask;
    }
    return undefined;
  }
}


async function chpl_runFileTask() {
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
  const wsPath = getWorkspaceFolder();
  const filePath = path.resolve(document.fileName);
  const tasks =
    (await Promise.all([vscode.tasks.fetchTasks({
      type: ChplBuildType,
    }), vscode.tasks.fetchTasks({
      type: ChplRunType,
    })])).flat()
      .filter(task => {
        const definition = task.definition as ChplBuildTaskDefinition | ChplRunTaskDefinition;

        const rootFile = path.resolve(resolveWorkspaceFolder(wsPath, definition.rootFile || ""));
        return rootFile === filePath;
      });

  if (tasks.length === 0) {
    vscode.window.showErrorMessage("No tasks found for this file.");
    return;
  }
  const selectedTask = await vscode.window.showQuickPick(tasks.map(task => task.name), {
    placeHolder: "Select a task to run",
  });
  if (!selectedTask) {
    return;
  }
  const task = tasks.find(t => t.name === selectedTask);
  if (!task) {
    vscode.window.showErrorMessage("Task not found.");
    return;
  }
  await vscode.tasks.executeTask(task);
}

async function chpl_mason_command(command: MasonCommand, args: string[] = [], masonFile: string | undefined = undefined) {
  const task = MasonTaskProvider.CreateMasonTask(command, args, masonFile);
  if (!task) {
    vscode.window.showErrorMessage("Could not run Mason command");
    return;
  }
  await vscode.tasks.executeTask(task);
}



export function registerChapelTaskProvider(context: vscode.ExtensionContext): void {
  // register the task providers
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider(ChplRunType, new ChplRunTaskProvider()),
    vscode.tasks.registerTaskProvider(ChplBuildType, new ChplBuildTaskProvider()),
    vscode.tasks.registerTaskProvider(MasonType, new MasonTaskProvider())
  );

  // register the commands
  context.subscriptions.push(
    vscode.commands.registerCommand("chapel.runFileTask", chpl_runFileTask),
    vscode.commands.registerCommand("chapel.mason.build", () => chpl_mason_command("build")),
    vscode.commands.registerCommand("chapel.mason.test", () => chpl_mason_command("test")),
    vscode.commands.registerCommand("chapel.mason.run", () => chpl_mason_command("run", ["--build"])),
    vscode.commands.registerCommand("chapel.mason.invokeTestFile", InvokeTestFileTask)
  );
}



function getEnv(def: ChplBuildTaskDefinition | ChplRunTaskDefinition | MasonTaskDefinition | undefined = undefined): Map<string, string> {
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

function replaceWithWorkspaceFolder(wsPath: string | undefined, filePath: string): string {
  if (wsPath) {
    if (filePath.startsWith(`${wsPath}/`)) {
      return filePath.replace(wsPath, "${workspaceFolder}");
    } else if (filePath === wsPath) {
      return "${workspaceFolder}";
    }
  }
  return filePath;
}
function resolveWorkspaceFolder(wsPath: string | undefined, filePath: string): string {
  if (wsPath && filePath.includes("${workspaceFolder}")) {
    return filePath.replace("${workspaceFolder}", wsPath);
  }
  return filePath;
}

// TODO: this function will need reworking to properly work with multi-root workspaces
function getWorkspaceFolder(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
