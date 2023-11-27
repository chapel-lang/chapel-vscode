const vscode = require("vscode");
const vlc = require("vscode-languageclient");

function activate(context) {
  var config = vscode.workspace.getConfiguration("chapel");

  //
  // Path to 'chpldef' currently has to be set in extension options.
  // TODO: Check for installed 'chpldef' binary.
  // TODO: Sanitize this path.
  //
  const serverBinaryPath = config.get("languageServerPath");
  if (!serverBinaryPath) {
    const msg = "Missing path to Chapel language server, unable to start";
    vscode.window.showErrorMessage(msg);
    return;
  }

  var args = config.get("languageServerArguments");

  const writeToLocalLog = config.get("writeToLocalLog");
  if (writeToLocalLog) {
    const path = context.asAbsolutePath('./local.log');
    const arg = "--log-file \"" + path + "\"";
    const msg = "Writing to local log: " + path;
    vscode.window.showInformationMessage(msg);
    args += " " + arg;
  }

  const userSetLogLevel = config.get("trace.server");
  if (userSetLogLevel != "off") {
    const msg = "Setting log level to: " + userSetLogLevel;
    vscode.window.showInformationMessage(msg);
    const arg = "--log-level=" + userSetLogLevel;
    args += " " + arg;
  }

  //
  // NOTE: We have some different transport options here:
  // { ipc, pipe, socket, stdio }
  //
  // TODO: I tried setting 'stdio' here and it completely broke everything.
  // However, 'stdio' also seems to be the default option? As in, if I just
  // don't _use_ the transport kind here, things seem to work.
  // 
  const tns = vlc.TransportKind.stdio;
  const serverOptions = {
    command : serverBinaryPath,
    args    : [ args ],
    options : { shell: true },
  };

  // TODO: Can set up a different kind of error handler (e.g., exit).
  const errorHandler = null;

  // TODO: Can synchronize on certain files with 'synchronize'.
  const clientOptions = {
    documentSelector  : [ { scheme: 'file', language: 'Chapel'} ],
    errorHandler      : errorHandler,
  };

  const sessionTag = "Chapel Language";
  var session = new vlc.LanguageClient(sessionTag,
                                       sessionTag,
                                       serverOptions,
                                       clientOptions);
  session.start();
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}
