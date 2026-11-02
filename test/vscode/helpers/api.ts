import * as vscode from "vscode";
import type { ChapelExtensionApi } from "../../../src/extension";

export const EXTENSION_ID = "chpl-hpe.chapel-vscode";

export function getExtension(): vscode.Extension<ChapelExtensionApi> {
  const ext = vscode.extensions.getExtension<ChapelExtensionApi>(EXTENSION_ID);
  if (!ext) {
    throw new Error(`extension ${EXTENSION_ID} is not installed`);
  }
  return ext;
}

export async function activateExtension(): Promise<ChapelExtensionApi> {
  return getExtension().activate();
}
