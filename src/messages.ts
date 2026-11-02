/*
 * Copyright 2024-2026 Hewlett Packard Enterprise Development LP
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
import { logger } from "./logger";

export function showInvalidPathWarning(
  tool: string,
  path: string,
  errorString?: string
) {
  if (errorString) {
    logger.warn(errorString);
  }

  let msg = `The path '${path}' for ${tool} is invalid, errors may occur. Please double check that this is the correct path.`;
  if (path === "") {
    msg = `The path for ${tool} is not set, errors may occur. Please either set the path or remove the empty path.`;
  }

  vscode.window.showWarningMessage(msg, "Show Log", "Ok").then((value) => {
    if (value === "Show Log") {
      logger.show();
    }
  });
}

export function showChplHomeMissingError(errorString?: string) {
  if (errorString) {
    logger.error(errorString);
  }
  vscode.window
    .showErrorMessage(
      "CHPL_HOME is incorrect, make sure the path is correct",
      "Find CHPL_HOME",
      "Show Log",
      "Ok"
    )
    .then((value) => {
      if (value === "Find CHPL_HOME") {
        vscode.commands.executeCommand("chapel.findChplHome");
      } else if (value === "Show Log") {
        logger.show();
      }
    });
}
