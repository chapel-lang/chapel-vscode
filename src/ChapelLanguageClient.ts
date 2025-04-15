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

import { ToolConfig, getChplDeveloper, getChplHome } from "./configuration";
import * as fs from "fs";
import * as vscode from "vscode";
import * as vlc from "vscode-languageclient/node";
import {
  checkToolPath,
  checkChplHome,
  cloneEnv,
  findToolPath,
  findPossibleChplHomes,
  getWorkspaceFolder,
} from "./ChplPaths";
import { showChplHomeMissingError } from "./extension";
import * as path from "path";

export enum LanguageClientState {
  DISABLED,
  STOPPED,
  STARTING,
  RUNNING,
  ERRORED,
}

class ErrorHandlingClient extends vlc.LanguageClient {
  infoHandler: (message: string, data?: any) => void;
  warningHandler: (message: string, data?: any) => void;
  errorHandler: (message: string, data?: any) => void;
  constructor(
    name: string,
    serverOptions: vlc.ServerOptions,
    clientOptions: vlc.LanguageClientOptions,
    infoHandler: (message: string, data?: any) => void,
    warningHandler: (message: string, data?: any) => void,
    errorHandler: (message: string, data?: any) => void
  ) {
    super(name, serverOptions, clientOptions);
    this.infoHandler = infoHandler;
    this.warningHandler = warningHandler;
    this.errorHandler = errorHandler;
  }

  override info(message: string, data?: any): void {
    this.infoHandler(message, data);
  }
  override warn(message: string, data?: any): void {
    this.warningHandler(message, data);
  }
  override error(message: string, data?: any): void {
    this.errorHandler(message, data);
  }
}

export abstract class ChapelLanguageClient {
  protected config_: ToolConfig;
  name: string;
  state: LanguageClientState;
  tool_path: string;
  client: ErrorHandlingClient | undefined;
  logger: vscode.LogOutputChannel;
  statusBarItem: vscode.StatusBarItem;

  constructor(
    config: ToolConfig,
    name: string,
    logger: vscode.LogOutputChannel
  ) {
    this.config_ = config;
    this.name = name;
    this.state = this.config_.enable
      ? LanguageClientState.STOPPED
      : LanguageClientState.DISABLED;
    this.tool_path = this.getToolPath();
    this.client = undefined;
    this.logger = logger;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      1000
    );
    // render the text using vscode codicons
    this.statusBarItem.text = `$(error) ${this.name}`;
    this.statusBarItem.tooltip = `${this.name} is stopped. Click to restart.`;
    this.statusBarItem.color = new vscode.ThemeColor(
      "statusBarItem.errorForeground"
    );
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
    this.statusBarItem.command = `${this.name}.restart`;
    this.statusBarItem.hide();
  }

  protected abstract getToolPath(): string;

  get config(): ToolConfig {
    return this.config_;
  }
  async resetConfig(config: ToolConfig) {
    await this.stop();
    this.config_ = config;
    this.state = this.config_.enable
      ? LanguageClientState.STOPPED
      : LanguageClientState.DISABLED;
    this.tool_path = this.getToolPath();
    await this.start();
  }

  setErrorState() {
    this.state = LanguageClientState.ERRORED;
    this.statusBarItem.show();
  }

  clearError(): void {
    this.state = LanguageClientState.STOPPED;
  }

  private errorFindTools() {
    this.setErrorState();
    // if invalid chplhome, prompt user to set it
    // if missing tool path, warn user that we can't find it, tell them to not override the path or upgrade their chapel version
    // otherwise, its likely the tools arent built, so prompt the user to build them

    if (this.tool_path === "") {
      vscode.window
        .showErrorMessage(
          `Could not determine the path for ${this.name}. Make sure it is installed. If it is, you may need to set the path manually.`,
          `Set ${this.name} Path`,
          "Set CHPL_HOME",
          "Show Log",
          "Ok"
        )
        .then((value) => {
          if (value === `Set ${this.name} Path`) {
            // TODO
          } else if (value === "Set CHPL_HOME") {
            vscode.commands.executeCommand("chapel.findChplHome");
          } else if (value === "Show Log") {
            this.logger.show();
          }
        });
    } else if (checkToolPath(this.tool_path) !== undefined) {
      vscode.window
        .showErrorMessage(
          `${this.name} is missing at the path '${this.tool_path}'. If you set the path manually, make sure it is correct. If it is, you may need to upgrade your Chapel version.`,
          "Show Log",
          "Ok"
        )
        .then((value) => {
          if (value === "Show Log") {
            this.logger.show();
          }
        });
    } else {
      vscode.window
        .showErrorMessage(
          `${this.name} encountered an error. You may need to rebuild ${this.name}.`,
          "Show Log",
          "Ok"
        )
        .then((value) => {
          if (value === "Show Log") {
            this.logger.show();
          }
        });
    }
  }

  protected abstract alwaysArguments(): Array<string>;

  start(): Promise<void> {
    if (this.state !== LanguageClientState.STOPPED) {
      return Promise.resolve();
    }
    this.state = LanguageClientState.STARTING;
    this.statusBarItem.hide();
    let toolPathError = checkToolPath(this.tool_path);
    if (toolPathError !== undefined) {
      this.logger.error(toolPathError);
      this.errorFindTools();
      return Promise.reject();
    }

    let env = cloneEnv();
    const chplhome = getChplHome();
    if (chplhome !== undefined && chplhome !== "") {
      this.logger.info(`Using CHPL_HOME: ${chplhome}`);
      const chplHomeError = checkChplHome(chplhome);
      if (chplHomeError !== undefined) {
        showChplHomeMissingError(chplHomeError);
      } else {
        env.CHPL_HOME = chplhome;
      }
    }
    env.CHPL_DEVELOPER = getChplDeveloper() ? "1" : "0";

    let args = this.alwaysArguments();
    args.push(...this.config.args);

    this.logger.info(`${this.name} path: '${this.tool_path}'`);
    this.logger.info(`${this.name} args: '${args}'`);

    const serverOptions: vlc.ServerOptions = {
      command: this.tool_path,
      args: args,
      options: {
        cwd: getWorkspaceFolder()?.uri.fsPath,
        env: env,
      },
    };
    this.logger.debug(
      `${this.name} server options ${JSON.stringify(
        serverOptions,
        undefined,
        2
      )}`
    );

    const errorLogger = (message: string) => {
      this.logger.error(`${this.name}: ${message}`);
    };
    const infoLogger = (message: string, data?: any) => {
      if (data) {
        this.logger.info(
          `${this.name}: ${message} - ${JSON.stringify(data, undefined, 2)}`
        );
      } else {
        this.logger.info(`${this.name}: ${message}`);
      }
    };
    const warningLogger = (message: string, data?: any) => {
      if (data) {
        this.logger.warn(
          `${this.name}: ${message} - ${JSON.stringify(data, undefined, 2)}`
        );
      } else {
        this.logger.warn(`${this.name}: ${message}`);
      }
    };
    const errorHandler = (message: string, data?: any) => {
      if (data) {
        errorLogger(`${message} - ${JSON.stringify(data, undefined, 2)}`);
      } else {
        errorLogger(message);
      }

      if (data && "code" in data) {
        const code = data.code;
        if (code == -32097) {
          this.errorFindTools();
        }
      }

      this.stop().finally(() => {
        this.setErrorState();

        vscode.window
          .showErrorMessage(
            `${this.name} encountered an unrecoverable error`,
            "Restart",
            "Show Log",
            "Ok"
          )
          .then((value) => {
            if (value === "Restart") {
              this.restart();
            } else if (value === "Show Log") {
              this.logger.show();
            }
          });
      });
    };

    const clientOptions: vlc.LanguageClientOptions = {
      documentSelector: [
        {
          scheme: "file",
          language: "chapel",
        },
      ],
      outputChannel: this.logger,
      connectionOptions: {
        maxRestartCount: 0,
      },
      initializationFailedHandler: () => {
        // always return false to trigger other error handlers
        return false;
      },
      errorHandler: {
        error: (error) => {
          errorHandler(error.message, true);
          return { action: vlc.ErrorAction.Shutdown, handled: true };
        },
        closed: () => {
          errorHandler("Server closed", true);
          return { action: vlc.CloseAction.DoNotRestart, handled: true };
        },
      },
    };
    this.logger.debug(
      `${this.name} server options ${JSON.stringify(
        serverOptions,
        undefined,
        2
      )}`
    );

    this.client = new ErrorHandlingClient(
      this.name,
      serverOptions,
      clientOptions,
      infoLogger,
      warningLogger,
      errorHandler
    );

    this.client.onDidChangeState((event) => {
      if (event.newState === vlc.State.Stopped) {
        this.state = LanguageClientState.STOPPED;
      } else if (event.newState === vlc.State.Running) {
        this.state = LanguageClientState.RUNNING;
      }
    });

    return this.client.start();
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client && this.state === LanguageClientState.RUNNING) {
        this.client.errorHandler = () => {};
        this.client.stop().catch(reject);
        this.client.dispose();
        this.client = undefined;
      }
      resolve();
    });
  }

  restart(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stop()
        .then(() => {
          this.clearError();
          this.start().then(resolve).catch(reject);
        })
        .catch(reject);
    });
  }
}

export class ChplCheckClient extends ChapelLanguageClient {
  getToolPath(): string {
    const path = findToolPath("chplcheck", getChplHome());
    if (path === undefined) {
      this.setErrorState();
      return "";
    }
    return path;
  }
  alwaysArguments(): Array<string> {
    return ["--lsp"];
  }
}
export class CLSClient extends ChapelLanguageClient {
  getToolPath(): string {
    const path = findToolPath("chpl-language-server", getChplHome());
    if (path === undefined) {
      this.setErrorState();
      return "";
    }
    return path;
  }
  alwaysArguments(): Array<string> {
    let args = [];
    if ("resolver" in this.config && this.config.resolver) {
      args.push("--resolver");
    }
    return args;
  }
}
