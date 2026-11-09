import * as vscode from "vscode";

// Original workspace values of every setting changed through setSetting.
const originals = new Map<string, unknown>();

function chapelConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("chapel");
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const config = chapelConfig();
  if (!originals.has(key)) {
    originals.set(key, config.inspect(key)?.workspaceValue);
  }
  await config.update(key, value, vscode.ConfigurationTarget.Workspace);
}

export async function restoreSettings(): Promise<void> {
  const config = chapelConfig();
  for (const [key, value] of originals) {
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }
  originals.clear();
}
