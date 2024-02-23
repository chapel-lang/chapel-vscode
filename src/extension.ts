import * as vscode from "vscode";
import {
  getChplHome,
  getCLSConfig,
  getChplCheckConfig,
  setChplHome,
} from "./configuration";
import { ChplCheckClient, CLSClient } from "./ChapelLanguageClient";
import { buildTools, checkChplHome, findPossibleChplHomes } from "./ChplPaths";

let chplcheckClient: ChplCheckClient;
let clsClient: CLSClient;
let logger: vscode.LogOutputChannel;

function showChplHomeMissingError(errorString?: string) {
  if (errorString) {
    logger.error(errorString);
  }
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
        logger.show();
      }
    });
}

function pickMyOwnChplHome() {
  vscode.window
    .showInputBox({
      placeHolder: "Enter the path to CHPL_HOME (possibly run `chpl --print-chpl-home` in the terminal to find it)",
    })
    .then((selection) => {
      if (selection !== undefined) {
        setChplHome(selection);
      }
    });
}
function selectChplHome(choices: string[]) {
  const pickMyOwn = "None of these - let me pick my own";
  choices.push(pickMyOwn);

  vscode.window
    .showQuickPick(choices, {
      placeHolder: "Select a CHPL_HOME",
    })
    .then((selection) => {
      if (selection === pickMyOwn) {
        pickMyOwnChplHome();
      } else if (selection !== undefined) {
        setChplHome(selection);
      }
    });
}

export function activate(context: vscode.ExtensionContext) {
  logger = vscode.window.createOutputChannel("chapel", { log: true });
  logger.info("Chapel extension activated");

  context.subscriptions.push(
    vscode.commands.registerCommand("chapel.findChpl", async () => {
      // show a selection to let the user select the proper CHPL_HOME
      let choices = findPossibleChplHomes();
      if (choices.length === 0) {
        pickMyOwnChplHome();
      } else {
        selectChplHome(choices);
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "chapel.buildTools",
      async (chplhome?: string) => {
        if (chplhome === undefined) {
          chplhome = getChplHome();
        }
        if (checkChplHome(chplhome) === undefined) {
          buildTools(chplhome);
        } else {
          vscode.window.showWarningMessage(
            `Unable to build automatically, please build manually`
          );
        }
      }
    )
  );

  const chplhome = getChplHome();
  const chplHomeError = checkChplHome(chplhome);
  if (chplHomeError !== undefined) {
    showChplHomeMissingError(chplHomeError);
  }

  chplcheckClient = new ChplCheckClient(
    chplhome,
    getChplCheckConfig(),
    "chplcheck",
    logger
  );
  clsClient = new CLSClient(
    chplhome,
    getCLSConfig(),
    "chpl-language-server",
    logger
  );

  if (chplHomeError !== undefined) {
    chplcheckClient.setErrorState();
    clsClient.setErrorState();
  }

  // Restart language server command
  context.subscriptions.push(
    vscode.commands.registerCommand("chplcheck.restart", async () => {
      logger.info("restarting chplcheck server");
      chplcheckClient.restart();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "chpl-language-server.restart",
      async () => {
        logger.info("restarting chpl-language-server server");
        clsClient.restart();
      }
    )
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("chapel")) {
        const chplhome = getChplHome();
        const chplHomeError = checkChplHome(chplhome);
        if (chplHomeError !== undefined) {
          showChplHomeMissingError(chplHomeError);
        }
        Promise.all([
          chplcheckClient.resetConfig(chplhome, getChplCheckConfig()),
          clsClient.resetConfig(chplhome, getCLSConfig()),
        ]);
      }
    })
  );

  // Start the language server once the user opens the first text document
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async () => {
      Promise.all([chplcheckClient.start(), clsClient.start()]);
    })
  );
}

export function deactivate() {
  return Promise.all([chplcheckClient.stop(), clsClient.stop()]);
}
