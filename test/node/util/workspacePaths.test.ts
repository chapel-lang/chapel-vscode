import * as assert from "assert";
import { replaceWithWorkspaceFolder, resolveWorkspaceFolder } from "../../../src/util/workspacePaths";

describe("util/workspacePaths", () => {
  const ws = "/ws";

  it("replaces the workspace prefix and resolves it back", () => {
    const replaced = replaceWithWorkspaceFolder(ws, "/ws/src/hello.chpl");
    assert.strictEqual(replaced, "${workspaceFolder}/src/hello.chpl");
    assert.strictEqual(resolveWorkspaceFolder(ws, replaced), "/ws/src/hello.chpl");
  });

  it("handles a path equal to the workspace", () => {
    const replaced = replaceWithWorkspaceFolder(ws, "/ws");
    assert.strictEqual(replaced, "${workspaceFolder}");
    assert.strictEqual(resolveWorkspaceFolder(ws, replaced), "/ws");
  });

  it("only replaces the leading workspace path", () => {
    assert.strictEqual(replaceWithWorkspaceFolder(ws, "/ws/ws/x"), "${workspaceFolder}/ws/x");
  });

  it("leaves a sibling path with a shared prefix unchanged", () => {
    assert.strictEqual(replaceWithWorkspaceFolder(ws, "/ws2/x"), "/ws2/x");
  });

  it("leaves paths outside the workspace unchanged", () => {
    assert.strictEqual(replaceWithWorkspaceFolder(ws, "/other/x"), "/other/x");
    assert.strictEqual(resolveWorkspaceFolder(ws, "/other/x"), "/other/x");
  });

  it("leaves paths unchanged when there is no workspace", () => {
    assert.strictEqual(replaceWithWorkspaceFolder(undefined, "/ws/x"), "/ws/x");
    assert.strictEqual(resolveWorkspaceFolder(undefined, "${workspaceFolder}/x"), "${workspaceFolder}/x");
  });
});
