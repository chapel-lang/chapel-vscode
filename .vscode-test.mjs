import { defineConfig } from "@vscode/test-cli";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const minVersion = pkg.engines.vscode.replace(/^\^/, "");

const launchArgs = ["--disable-extensions"];
// Electron's sandbox is unavailable on Linux CI runners and in containers
if (process.platform === "linux") {
  launchArgs.push("--no-sandbox");
}

const unit = {
  files: "out/test/vscode/unit/**/*.test.js",
  workspaceFolder: "out/test-workspaces/basic",
  launchArgs,
  env: {
    CHAPEL_VSCODE_RESTART_DEBOUNCE_MS: "200",
    // Created empty by test/scripts/prepare-workspaces.mjs
    FAKE_LSP_RECORD_DIR: fileURLToPath(new URL("./out/fake-lsp-records", import.meta.url)),
    FAKE_TOOL_RECORD_DIR: fileURLToPath(new URL("./out/fake-tool-records", import.meta.url)),
    // Overridden by chapel.baseEnv and task env in tasks.test.ts
    TEST_ENV_PROCESS: "process",
    TEST_ENV_BASE: "process",
    TEST_ENV_TASK: "process",
  },
  mocha: { ui: "bdd", timeout: 20000 },
};

const absPath = (rel) => fileURLToPath(new URL(rel, import.meta.url));

// Opens hello.chpl at startup, in a workspace that enables the fake servers
const unitStartup = {
  ...unit,
  files: "out/test/vscode/startup/**/*.test.js",
  workspaceFolder: "out/test-workspaces/startup",
  launchArgs: [...launchArgs, absPath("./out/test-workspaces/startup/hello.chpl")],
};

// An empty window, with the fake server settings in a user data dir made by
// prepare-workspaces.mjs. Its path is as long as the default .vscode-test/user-data
// because macOS limits the IPC socket path inside it to 103 chars.
const unitNoFolder = {
  ...unit,
  files: "out/test/vscode/noFolder/**/*.test.js",
  workspaceFolder: undefined,
  launchArgs: [...launchArgs, `--user-data-dir=${absPath("./.vscode-test/no-folder")}`],
};

// A Mason project whose settings (from prepare-workspaces.mjs) use the fake chpl and mason
const unitMason = {
  ...unit,
  files: "out/test/vscode/mason/**/*.test.js",
  workspaceFolder: "out/test-workspaces/mason-fake",
};

// Chapel files plus the settings and tasks.json from prepare-workspaces.mjs
const unitTasks = {
  ...unit,
  files: "out/test/vscode/tasks/**/*.test.js",
  workspaceFolder: "out/test-workspaces/tasks",
};

// Integration tests run the real chplcheck and chpl-language-server from PATH.
function integration(label, workspace, dir) {
  return {
    label,
    files: `out/test/vscode/integration/${dir}/**/*.test.js`,
    workspaceFolder: `out/test-workspaces/${workspace}`,
    launchArgs,
    env: unit.env,
    mocha: { ui: "bdd", timeout: 180000 },
  };
}

export default defineConfig([
  { label: "unit", ...unit },
  { label: "unit-min-engine", version: minVersion, ...unit },
  { label: "unit-startup", ...unitStartup },
  { label: "unit-no-folder", ...unitNoFolder },
  { label: "unit-mason", ...unitMason },
  { label: "unit-tasks", ...unitTasks },
  integration("integration-basic", "integration", "basic"),
  integration("integration-cls-commands", "cls-commands", "clsCommands"),
  integration("integration-mason", "mason-project", "mason"),
]);
