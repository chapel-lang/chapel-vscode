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

export interface ParsedChplLink {
  startIndex: number;
  length: number;
  path: string;
  lineNum: number;
}

const optionalLineCol = "(?::(\\d+)(?::(\\d+))?)?";
const linePattern = new RegExp("(\\$CHPL_HOME[^\\s:]+)" + optionalLineCol);

export function parseChplHomeLink(
  line: string,
  chplHome: string | undefined
): ParsedChplLink | undefined {
  const match = linePattern.exec(line);
  if (!match) {
    return undefined;
  }

  let path = match[1];
  const lineNumStr = match[2];
  const lineNum = lineNumStr ? parseInt(lineNumStr) : -1;
  const startIndex = match.index;
  const length = match[0].length;

  if (chplHome && chplHome !== "") {
    path = path.replace("$CHPL_HOME", chplHome);
  }
  return { startIndex, length, path, lineNum };
}
