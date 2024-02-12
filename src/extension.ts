import * as path from "path";
import * as vscode from "vscode";

let chplcheckClient: LanguageClient | undefined;
let chplcheckClientStarting = false;
let clsClient: LanguageClient | undefined;
let clsClientStarting = false;
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
    vscode.commands.registerCommand("chpl-language-server.restart", async () => {
      logger.info("restarting chpl-language-server server");
      await startCLS();
    })
  );

  let env = process.env;
  const chplhome = getChplHome();
  env.CHPL_HOME = chplhome!;
  env.CHPL_DEVELOPER = getChplDeveloper() ? "1" : "0";

	context.subscriptions.push(
    vscode.commands.registerCommand('chapel.runFile', (filepath: string) => {
		  const terminal = vscode.window.createTerminal({env: env});
      terminal.sendText("cd $CHPL_HOME && source util/setchplenv.bash && cd -")
		  terminal.sendText("chpl " + filepath + " -o a.out && ./a.out");
      terminal.show();
	  })
  );


  // Start the language server once the user opens the first text document
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async () => {
      if (!chplcheckClient) {
        await startChplCheck();
      }
      if (!clsClient) {
        await startCLS();
      }
    })
  );

  // formatter.addFormatter();
}

// This method is called when your extension is deactivated
export function deactivate() {
  return Promise.all([
    stopLangServer(chplcheckClient),
    stopLangServer(clsClient),
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

function getCLSArgs(): Array<string> {
  const config = vscode.workspace.getConfiguration("chapel");
  const cls = config.get<ToolConfig>("chpl-language-server") ?? {};
  return cls.args ?? [];
}
function getChplCheckEnabled(): boolean {
  const config = vscode.workspace.getConfiguration("chapel");
  const chplcheck = config.get<ToolConfig>("chplcheck") ?? {};
  return chplcheck.enable ?? true;
}
function getCLSEnabled(): boolean {
  const config = vscode.workspace.getConfiguration("chapel");
  const cls = config.get<ToolConfig>("chpl-language-server") ?? {};
  return cls.enable ?? true;
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
function getCLS(chplhome: string): string {
  const config = vscode.workspace.getConfiguration("chapel");
  const cls = config.get<ToolConfig>("chpl-language-server") ?? {};
  let p = cls.path;
  if (p) {
    return p;
  }
  p = path.resolve(path.join(chplhome, "tools", "chpl-language-server", "chpl-language-server"));
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

async function startCLS() {
  if (!getCLSEnabled()) {
    return;
  }
  // Don't interfere if we are already in the process of launching the server.
  if (clsClientStarting) {
    return;
  }

  clsClientStarting = true;
  if (clsClient) {
    await stopLangServer(clsClient);
    clsClientStarting = false;
  }

  const chplhome = getChplHome();

  if (!chplhome) {
    logger.error(`Unable to start server, missing CHPL_HOME`);
    await stopLangServer(clsClient);
    clsClientStarting = false;
  }

  const cls = getCLS(chplhome!);

  var args = [];
  var userArgs = getCLSArgs();
  args.push(...userArgs);

  logger.info(`chpl-language-server path: '${cls}'`);
  logger.info(`chpl-language-server args: '${userArgs}'`);

  let env = process.env;
  env.CHPL_HOME = chplhome!;
  env.CHPL_DEVELOPER = getChplDeveloper() ? "1" : "0";

  const serverOptions: ServerOptions = {
    command: cls!,
    args: args,
    options: {
      cwd: chplhome!,
      env: env,
    },
  };
  logger.debug("server options", serverOptions);

  try {
    clsClient = new LanguageClient(
      "chpl-language-server",
      serverOptions,
      getClientOptions()
    );
    await clsClient.start();
    clsClientStarting = false;
  } catch (err) {
    clsClientStarting = false;
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
