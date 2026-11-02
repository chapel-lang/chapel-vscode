import * as vscode from "vscode";

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  fn: () => T | undefined | null | false | Promise<T | undefined | null | false>,
  opts: WaitOptions = {}
): Promise<T> {
  const timeout = opts.timeout ?? 10000;
  const interval = opts.interval ?? 100;
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) {
      return value;
    }
    if (Date.now() > deadline) {
      const suffix = opts.message ? `: ${opts.message}` : "";
      throw new Error(`Timed out after ${timeout}ms${suffix}`);
    }
    await sleep(interval);
  }
}

export function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (diagnostics: vscode.Diagnostic[]) => boolean,
  opts: WaitOptions = {}
): Promise<vscode.Diagnostic[]> {
  return waitFor(() => {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return predicate(diagnostics) ? diagnostics : undefined;
  }, { message: `diagnostics for ${uri.fsPath}`, ...opts });
}
