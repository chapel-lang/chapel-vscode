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

// Fake language servers record their argv and env here (see .vscode-test.mjs).
const records = path.join(root, "out", "fake-lsp-records");
rmSync(records, { recursive: true, force: true });
mkdirSync(records, { recursive: true });
