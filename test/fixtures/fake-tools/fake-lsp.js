// A stand-in for chplcheck and chpl-language-server, driven by FAKE_* env vars.
const fs = require("fs");
const path = require("path");
const {
  createConnection,
  DiagnosticSeverity,
  ErrorCodes,
  ResponseError,
  TextDocumentSyncKind,
} = require("vscode-languageserver/node");

const tool = process.argv[2];
const args = process.argv.slice(3);

if (args.includes("--version")) {
  process.stdout.write(`${tool} ${process.env.FAKE_LSP_VERSION || "2.10.0"}\n`);
  process.exit(0);
}

const mode = process.env.FAKE_LSP_MODE || "normal";

function writeRecord() {
  const dir = process.env.FAKE_LSP_RECORD_DIR;
  if (!dir) {
    return;
  }
  const env = {
    CHPL_HOME: process.env.CHPL_HOME,
    CHPL_DEVELOPER: process.env.CHPL_DEVELOPER,
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("FAKE_") || key.startsWith("TEST_")) {
      env[key] = value;
    }
  }
  const record = { tool, pid: process.pid, argv: args, cwd: process.cwd(), env };
  const file = path.join(dir, `${tool}-${process.pid}.json`);
  fs.mkdirSync(dir, { recursive: true });
  // Write then rename so readers never see a partial record
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(record, undefined, 2));
  fs.renameSync(`${file}.tmp`, file);
}

writeRecord();

const connection = createConnection(process.stdin, process.stdout);

connection.onInitialize(async () => {
  if (mode === "slow-init") {
    const delay = Number(process.env.FAKE_LSP_DELAY_MS || "3000");
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      hoverProvider: true,
    },
  };
});

function publishFakeDiagnostic(uri) {
  connection.sendDiagnostics({
    uri,
    diagnostics: [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        severity: DiagnosticSeverity.Warning,
        message: `fake diagnostic from ${tool}`,
        source: tool,
      },
    ],
  });
}

connection.onDidOpenTextDocument((params) => {
  if (mode === "exit-on-open") {
    process.exit(1);
  }
  publishFakeDiagnostic(params.textDocument.uri);
});

connection.onDidChangeTextDocument((params) => {
  publishFakeDiagnostic(params.textDocument.uri);
});

connection.onHover(() => {
  if (mode === "fail-hover") {
    return new ResponseError(ErrorCodes.InternalError, `fake hover failure from ${tool}`);
  }
  return { contents: `fake hover from ${tool}` };
});

connection.listen();
