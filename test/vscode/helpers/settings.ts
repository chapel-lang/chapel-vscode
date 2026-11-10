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

// Returns the number of settings that were restored.
export async function restoreSettings(): Promise<number> {
  const config = chapelConfig();
  const count = originals.size;
  for (const [key, value] of originals) {
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }
  originals.clear();
  return count;
}
