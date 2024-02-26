import { ToolConfig, getChplDeveloper } from "./configuration";
import * as fs from "fs";
import * as vscode from "vscode";
import * as vlc from "vscode-languageclient/node";
import { checkToolPath, checkChplHome, cloneEnv } from "./ChplPaths";
import * as path from "path";

export enum LanguageClientState {
  DISABLED,
  STOPPED,
  STARTING,
  RUNNING,
  ERRORED,
}

class ErrorHandlingClient extends vlc.LanguageClient {
  errorHandler: (message: string, fatal: boolean, data?: any) => void;
  constructor(
    name: string,
    serverOptions: vlc.ServerOptions,
    clientOptions: vlc.LanguageClientOptions,
    errorHandler: (message: string, fatal: boolean, data?: any) => void
  ) {
    super(name, serverOptions, clientOptions);
    this.errorHandler = errorHandler;
  }

  override info(message: string, data?: any): void {
    this.errorHandler(message, false, data);
  }
  override warn(message: string, data?: any): void {
    this.errorHandler(message, false, data);
  }
  override error(message: string, data?: any): void {
    this.errorHandler(message, true, data);
  }
}

export abstract class ChapelLanguageClient {
  chplhome: string;
  protected config_: ToolConfig;
  name: string;
  state: LanguageClientState;
  tool_path: string;
  client: ErrorHandlingClient | undefined;
  logger: vscode.LogOutputChannel;

  constructor(
    chplhome: string,
    config: ToolConfig,
    name: string,
    logger: vscode.LogOutputChannel
  ) {
    this.chplhome = chplhome;
    this.config_ = config;
    this.name = name;
    this.state = this.config_.enable
      ? LanguageClientState.STOPPED
      : LanguageClientState.DISABLED;
    this.tool_path = this.getToolPath();
    this.client = undefined;
    this.logger = logger;
  }

  protected abstract getToolPath(): string;

  get config(): ToolConfig {
    return this.config_;
  }
  async resetConfig(chplhome: string, config: ToolConfig) {
    await this.stop();
    this.chplhome = chplhome;
    this.config_ = config;
    this.state = this.config_.enable
      ? LanguageClientState.STOPPED
      : LanguageClientState.DISABLED;
    this.tool_path = this.getToolPath();
    await this.start();
  }

  setErrorState() {
    this.state = LanguageClientState.ERRORED;
  }

  clearError(): void {
    this.state = LanguageClientState.STOPPED;
  }

  private errorFindTools() {
    // if invalid chplhome, prompt user to set it
    // if missing tool path, warn user that we can't find it, tell them to not override the path or upgrade their chapel version
    // otherwise, its likely the tools arent built, so prompt the user to build them

    if (checkChplHome(this.chplhome) !== undefined) {
      vscode.window
        .showErrorMessage(
          "CHPL_HOME is either missing or incorrect, make sure the path is correct",
          "Find CHPL_HOME",
          "Show Log",
          "Ok"
        )
        .then((value) => {
          if (value === "Find CHPL_HOME") {
            vscode.commands.executeCommand("chapel.findChpl");
          } else if (value === "Show Log") {
            this.logger.show();
          }
        });
    } else if (checkToolPath(this.tool_path) !== undefined) {
      vscode.window
        .showErrorMessage(
          `${this.name} does not exist in the CHPL_HOME directory, make sure you are using the correct version of Chapel`,
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
          `${this.name} encountered an error, this is likely because ${this.name} is not installed. Double check that ${this.name} is built.`,
          "Build Tools",
          "Show Log",
          "Ok"
        )
        .then((value) => {
          if (value === "Build Tools") {
            vscode.commands.executeCommand(`chapel.buildTools`, this.chplhome);
          } else if (value === "Show Log") {
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
    let toolPathError = checkToolPath(this.tool_path);
    if (toolPathError !== undefined) {
      this.logger.error(toolPathError);
      this.errorFindTools();
      this.state = LanguageClientState.STOPPED;
      return Promise.reject();
    }

    let env = cloneEnv();
    env.CHPL_HOME = this.chplhome;
    env.CHPL_DEVELOPER = getChplDeveloper() ? "1" : "0";

    let args = this.alwaysArguments();
    args.push(...this.config.args);

    this.logger.info(`${this.name} path: '${this.tool_path}'`);
    this.logger.info(`${this.name} args: '${args}'`);

    const serverOptions: vlc.ServerOptions = {
      command: this.tool_path,
      args: args,
      options: {
        cwd: this.chplhome,
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
    const errorHandler = (
      message: string,
      fatal: boolean = false,
      data?: any
    ) => {
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

      if (fatal) {
        this.stop().finally(() => {
          this.state = LanguageClientState.ERRORED;

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
      }
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
    return path.join(this.chplhome, "tools", "chplcheck", "chplcheck");
  }
  alwaysArguments(): Array<string> {
    return ["--lsp"];
  }
}
export class CLSClient extends ChapelLanguageClient {
  getToolPath(): string {
    return path.join(this.chplhome, "tools", "chpl-language-server", "chpl-language-server");
  }
  alwaysArguments(): Array<string> {
    let args = [];
    if ("resolver" in this.config && this.config.resolver) {
      args.push("--resolver");
    }
    return args;
  }
}
