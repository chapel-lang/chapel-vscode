import { defineConfig } from "@vscode/test-cli";
import { readFileSync } from "node:fs";

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
  env: { CHAPEL_VSCODE_RESTART_DEBOUNCE_MS: "200" },
  mocha: { ui: "bdd", timeout: 20000 },
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
  integration("integration-basic", "integration", "basic"),
  integration("integration-cls-commands", "cls-commands", "clsCommands"),
  integration("integration-mason", "mason-project", "mason"),
]);
