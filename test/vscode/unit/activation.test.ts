import * as assert from "assert";
import * as vscode from "vscode";
import { activateExtension, getExtension } from "../helpers/api";

describe("activation", () => {
  it("returns the language clients", async () => {
    const api = await activateExtension();
    assert.strictEqual(api.chplcheck.name, "chplcheck");
    assert.strictEqual(api.cls.name, "chpl-language-server");
  });

  it("registers every contributed command", async () => {
    await activateExtension();
    const contributed: { command: string }[] = getExtension().packageJSON.contributes.commands;
    const registered = new Set(await vscode.commands.getCommands(true));
    for (const { command } of contributed) {
      assert.ok(registered.has(command), `${command} is not registered`);
    }
  });
});
