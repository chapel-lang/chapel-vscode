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
import { logger } from "./extension";

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

const optionalLineCol = '(?::(\\d+)(?::(\\d+))?)?';
const linePattern = new RegExp('(\\$CHPL_HOME[^\\s:]+)' + optionalLineCol);

// a terminal link provider to handle links like $CHPL_HOME/...
export class ChplTerminalLinkProvider implements vscode.TerminalLinkProvider {
  provideTerminalLinks(context: vscode.TerminalLinkContext, _token: vscode.CancellationToken): vscode.ProviderResult<ChplLink[]> {
    const line = context.line;

    const match = linePattern.exec(line);
    if (!match) {
      return [];
    }

    let path = match[1];
    const lineNumStr = match[2];
    const lineNum = lineNumStr ? parseInt(lineNumStr) : -1;
    logger.debug(`Found terminal link: ${path} at line ${lineNum}`);

    const startIndex = match.index;
    const length = match[0].length;
    logger.debug(`Link startIndex: ${startIndex}, length: ${length}`);

    // resolve the CHPL_HOME
    const chplHome = getChplHome();
    logger.debug(`Resolving $CHPL_HOME to ${chplHome}`);
    if (chplHome && chplHome !== "") {
      path = path.replace("$CHPL_HOME", chplHome);
    }
    logger.debug(`Resolved terminal link path: ${path}`);

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
          const lineNum = link.data.lineNum;
          if (lineNum === -1) {
            return;
          }
          // const lineWidth = editor.document.lineAt(lineNum).text.length;

          // jump to the line
          const startPos = new vscode.Position(lineNum - 1, 0);
          var range = new vscode.Range(startPos, startPos);
          editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
          editor.selection = new vscode.Selection(startPos, startPos);
        });
      });
    }
  }
}
