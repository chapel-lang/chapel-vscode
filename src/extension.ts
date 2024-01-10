import * as path from "path";
import * as vscode from "vscode";

let chplcheckClient: LanguageClient | undefined;
let chplcheckClientStarting = false;
let chpldefClient: LanguageClient | undefined;
let chpldefClientStarting = false;
let logger: vscode.LogOutputChannel;

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  State,
} from "vscode-languageclient/node";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  logger = vscode.window.createOutputChannel("chapel", { log: true });
  logger.info("Extension activated.");

  // Restart language server command
  context.subscriptions.push(
    vscode.commands.registerCommand("chplcheck.restart", async () => {
      logger.info("restarting chplcheck server");
      await startChplCheck();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("chpldef.restart", async () => {
      logger.info("restarting chpldef server");
      await startChplDef();
    })
  );

  // Start the language server once the user opens the first text document
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async () => {
      if (!chplcheckClient) {
        await startChplCheck();
      }
      if (!chpldefClient) {
        await startChplDef();
      }
    })
  );

  // formatter.addFormatter();
}

// This method is called when your extension is deactivated
export function deactivate() {
  return Promise.all([
    stopLangServer(chplcheckClient),
    stopLangServer(chpldefClient),
  ]);
}

function getChplHome(): string | undefined {
  const config = vscode.workspace.getConfiguration("chapel");
  const chplhome = config.get<string>("CHPL_HOME");

  return chplhome;
}

function getChplDeveloper(): boolean {
  const config = vscode.workspace.getConfiguration("chapel");
  const devel = config.get<boolean>("CHPL_DEVELOPER");

  return devel ?? false;
}

interface ToolConfig {
  args?: Array<string>;
  path?: string;
  enable?: boolean;
}

function getChplCheckArgs(): Array<string> {
  const config = vscode.workspace.getConfiguration("chapel");
  const chplcheck = config.get<ToolConfig>("chplcheck") ?? {};
  return chplcheck.args ?? [];
}

function getChplDefArgs(): Array<string> {
  const config = vscode.workspace.getConfiguration("chapel");
  const chpldef = config.get<ToolConfig>("chpldef") ?? {};
  return chpldef.args ?? [];
}
function getChplCheckEnabled(): boolean {
  const config = vscode.workspace.getConfiguration("chapel");
  const chplcheck = config.get<ToolConfig>("chplcheck") ?? {};
  return chplcheck.enable ?? false;
}
function getChplDefEnabled(): boolean {
  const config = vscode.workspace.getConfiguration("chapel");
  const chpldef = config.get<ToolConfig>("chpldef") ?? {};
  return chpldef.enable ?? false;
}

function getChplCheck(chplhome: string): string {
  const config = vscode.workspace.getConfiguration("chapel");
  const chplcheck = config.get<ToolConfig>("chplcheck") ?? {};
  let p = chplcheck.path;
  if (p) {
    return p;
  }
  p = path.resolve(path.join(chplhome, "tools", "chplcheck", "chplcheck"));
  return p;
}
function getChplDef(chplhome: string): string {
  const config = vscode.workspace.getConfiguration("chapel");
  const chpldef = config.get<ToolConfig>("chpldef") ?? {};
  let p = chpldef.path;
  if (p) {
    return p;
  }
  p = path.resolve(path.join(chplhome, "bin", "darwin-arm64", "chpldef"));
  return p;
}

async function startChplCheck() {
  if (!getChplCheckEnabled()) {
    return;
  }
  // Don't interfere if we are already in the process of launching the server.
  if (chplcheckClientStarting) {
    return;
  }

  chplcheckClientStarting = true;
  if (chplcheckClient) {
    await stopLangServer(chplcheckClient);
    chplcheckClientStarting = false;
  }

  const chplhome = getChplHome();

  if (!chplhome) {
    logger.error(`Unable to start server, missing CHPL_HOME`);
    await stopLangServer(chplcheckClient);
    chplcheckClientStarting = false;
  }

  const chplcheck = getChplCheck(chplhome!);

  var args = ["--lsp"];
  var userArgs = getChplCheckArgs();
  args.push(...userArgs);

  logger.info(`chplcheck path: '${chplcheck}'`);
  logger.info(`chplcheck args: '${userArgs}'`);

  let env = process.env;
  env.CHPL_HOME = chplhome!;
  env.CHPL_DEVELOPER = getChplDeveloper() ? "1" : "0";

  const serverOptions: ServerOptions = {
    command: chplcheck!,
    args: args,
    options: {
      cwd: chplhome!,
      env: env,
    },
  };
  logger.debug("server options", serverOptions);

  try {
    chplcheckClient = new LanguageClient(
      "chplcheck",
      serverOptions,
      getClientOptions()
    );
    await chplcheckClient.start();
    chplcheckClientStarting = false;
  } catch (err) {
    chplcheckClientStarting = false;
    logger.error(`Unable to start server: ${err}`);
  }
}

async function startChplDef() {
  if (!getChplDefEnabled()) {
    return;
  }
  // Don't interfere if we are already in the process of launching the server.
  if (chpldefClientStarting) {
    return;
  }

  chpldefClientStarting = true;
  if (chpldefClient) {
    await stopLangServer(chpldefClient);
    chpldefClientStarting = false;
  }

  const chplhome = getChplHome();

  if (!chplhome) {
    logger.error(`Unable to start server, missing CHPL_HOME`);
    await stopLangServer(chpldefClient);
    chpldefClientStarting = false;
  }

  const chpldef = getChplDef(chplhome!);

  var args = [];
  var userArgs = getChplDefArgs();
  args.push(...userArgs);

  logger.info(`chpldef path: '${chpldef}'`);
  logger.info(`chpldef args: '${userArgs}'`);

  let env = process.env;
  env.CHPL_HOME = chplhome!;
  env.CHPL_DEVELOPER = getChplDeveloper() ? "1" : "0";

  const serverOptions: ServerOptions = {
    command: chpldef!,
    args: args,
    options: {
      cwd: chplhome!,
      env: env,
    },
  };
  logger.debug("server options", serverOptions);

  try {
    chpldefClient = new LanguageClient(
      "chpldef",
      serverOptions,
      getClientOptions()
    );
    await chpldefClient.start();
    chpldefClientStarting = false;
  } catch (err) {
    chpldefClientStarting = false;
    logger.error(`Unable to start server: ${err}`);
  }
}

async function stopLangServer(
  client: LanguageClient | undefined
): Promise<void> {
  if (!client) {
    return;
  }

  if (client.state === State.Running) {
    await client.stop();
  }

  client.dispose();
  client = undefined;
}
function getClientOptions() {
  const options = {
    documentSelector: [
      {
        scheme: "file",
        language: "chapel",
      },
    ],
    outputChannel: logger,
    connectionOptions: {
      maxRestartCount: 0, // don't restart on server failure.
    },
  };
  logger.info(`client options: ${JSON.stringify(options, undefined, 2)}`);
  return options;
}
