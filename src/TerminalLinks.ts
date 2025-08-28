/*
 * Copyright 2025-2025 Hewlett Packard Enterprise Development LP
 * Other additional copyright holders may be indicated within.
 *
 * The entirety of this work is licensed under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 *
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import { getChplHome } from "./configuration";

export class ChplLink implements vscode.TerminalLink {
  startIndex: number;
  length: number;
  data: { path: string; lineNum: number };

  constructor(startIndex: number, length: number, path: string, lineNum: number) {
    this.startIndex = startIndex;
    this.length = length;
    this.data = { path, lineNum };
  }
}

// a terminal link provider to handle links like $CHPL_HOME/...
export class ChplTerminalLinkProvider implements vscode.TerminalLinkProvider {
  provideTerminalLinks(context: vscode.TerminalLinkContext, _token: vscode.CancellationToken): vscode.ProviderResult<ChplLink[]> {
    const line = context.line;
    const startIndex = line.indexOf("$CHPL_HOME");
    if (startIndex === -1) return [];

    const suffix = ".chpl";
    const endIndex = line.indexOf(suffix + ":", startIndex);
    if (endIndex === -1) return [];

    var path = line.substring(startIndex, endIndex + suffix.length);

    const lineNumStart = endIndex + suffix.length + 1;
    const lineNumEnd = line.indexOf(":", lineNumStart);
    const lineNum = lineNumEnd !== -1 ?
      parseInt(line.substring(lineNumStart, lineNumEnd)) : -1;
    if (isNaN(lineNum)) return [];

    const length = lineNum !== -1 ?
      lineNumEnd - startIndex : endIndex + suffix.length + 1 - startIndex;

    // resolve the CHPL_HOME
    const chplHome = getChplHome();
    if (chplHome && chplHome !== "") {
      path = path.replace("$CHPL_HOME", chplHome);
    }

    const termLink = new ChplLink(startIndex, length, path, lineNum);
    return [termLink];
  }
  handleTerminalLink(link: ChplLink) {
    const path = link.data.path;
    const lineNum = link.data.lineNum;

    // if the path doesn't exist, offer the user the chance to use the quick open
    if (!fs.existsSync(path)) {
      const pathLine = lineNum !== -1 ? `${path}:${lineNum}` : path;
      vscode.commands.executeCommand("workbench.action.quickOpen", pathLine);
    } else {
      // jump directly to the file
      const uri = vscode.Uri.file(link.data.path);

      vscode.workspace.openTextDocument(uri).then((doc) => {
        vscode.window.showTextDocument(doc).then((editor) => {
          if (link.data.lineNum === -1) {
            return;
          }
          // jump to the line
          const pos = new vscode.Position(link.data.lineNum - 1, 0);
          var range = new vscode.Range(pos, pos);
          editor.revealRange(range);
        });
      });
    }
  }
}
