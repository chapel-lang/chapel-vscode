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
import { logger } from "./logger";
import { parseChplHomeLink } from "./util/terminalLinks";

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
    const chplHome = getChplHome();
    const parsed = parseChplHomeLink(context.line, chplHome);
    if (!parsed) {
      return [];
    }

    const { startIndex, length, path, lineNum } = parsed;
    logger.debug(`Found terminal link at line ${lineNum}`);
    logger.debug(`Link startIndex: ${startIndex}, length: ${length}`);
    logger.debug(`Resolving $CHPL_HOME to ${chplHome}`);
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
