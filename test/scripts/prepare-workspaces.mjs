// Tests write settings and files, so they run against copies of the fixture workspaces.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = path.join(root, "test", "fixtures", "workspaces");
const dest = path.join(root, "out", "test-workspaces");

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });

// Fake language servers record their argv and env here (see .vscode-test.mjs).
const records = path.join(root, "out", "fake-lsp-records");
rmSync(records, { recursive: true, force: true });
mkdirSync(records, { recursive: true });
