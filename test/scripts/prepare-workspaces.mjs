// Tests write settings and files, so they run against copies of the fixture workspaces.
import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = path.join(root, "test", "fixtures", "workspaces");
const dest = path.join(root, "out", "test-workspaces");

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
