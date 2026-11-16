// Tests write settings and files, so they run against copies of the fixture workspaces.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = path.join(root, "test", "fixtures", "workspaces");
const dest = path.join(root, "out", "test-workspaces");

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });

// Settings that enable both servers with the fake shims, which need absolute paths
const fakeTools = path.join(root, "test", "fixtures", "fake-tools");
const fakeServerSettings = JSON.stringify({
  "chapel.chplcheck.enable": true,
  "chapel.chplcheck.path": path.join(fakeTools, "chplcheck"),
  "chapel.chpl-language-server.enable": true,
  "chapel.chpl-language-server.path": path.join(fakeTools, "chpl-language-server"),
}, undefined, 2);

function writeSettings(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "settings.json"), fakeServerSettings);
}

// unit-startup: the basic workspace with both fake servers enabled
const startup = path.join(dest, "startup");
cpSync(path.join(src, "basic"), startup, { recursive: true });
writeSettings(path.join(startup, ".vscode"));

// unit-no-folder has no workspace settings, so it uses a fresh user data dir instead
const userData = path.join(root, ".vscode-test", "no-folder");
rmSync(userData, { recursive: true, force: true });
writeSettings(path.join(userData, "User"));

// unit-mason: the fake chpl and mason, with both language servers disabled
const noServers = {
  "chapel.chplcheck.enable": false,
  "chapel.chpl-language-server.enable": false,
};
const fakeBuildSettings = {
  ...noServers,
  "chapel.defaultCompiler": path.join(fakeTools, "chpl"),
  "chapel.defaultMason": path.join(fakeTools, "mason"),
};
const masonSettings = path.join(dest, "mason-fake", ".vscode");
mkdirSync(masonSettings, { recursive: true });
writeFileSync(path.join(masonSettings, "settings.json"), JSON.stringify(fakeBuildSettings, undefined, 2));

// unit-tasks: provided tasks are computed once, so these must exist before startup
const tasksSettings = path.join(dest, "tasks", ".vscode");
mkdirSync(tasksSettings, { recursive: true });
writeFileSync(path.join(tasksSettings, "settings.json"), JSON.stringify({
  ...fakeBuildSettings,
  "chapel.baseEnv": { TEST_ENV_BASE: "baseEnv", TEST_ENV_TASK: "baseEnv" },
}, undefined, 2));
writeFileSync(path.join(tasksSettings, "tasks.json"), JSON.stringify({
  version: "2.0.0",
  tasks: [
    {
      type: "chpl-build-run",
      label: "build and run envcheck from tasks.json",
      sourceFiles: ["${workspaceFolder}/envcheck.chpl"],
      executable: "${workspaceFolder}/envcheck",
      env: { TEST_ENV_TASK: "task" },
    },
    {
      type: "chpl-run",
      label: "run fake program from tasks.json",
      executable: path.join(fakeTools, "fake-program"),
    },
    {
      type: "chpl",
      label: "compile picked.chpl from tasks.json",
      rootFile: "${workspaceFolder}/picked.chpl",
      args: ["${workspaceFolder}/picked.chpl", "-o", "${workspaceFolder}/picked-from-tasks-json"],
    },
  ],
}, undefined, 2));

// Fake language servers and build tools record their argv and env here (see .vscode-test.mjs).
for (const dir of ["fake-lsp-records", "fake-tool-records"]) {
  const records = path.join(root, "out", dir);
  rmSync(records, { recursive: true, force: true });
  mkdirSync(records, { recursive: true });
}
