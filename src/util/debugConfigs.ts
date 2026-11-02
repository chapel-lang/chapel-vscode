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

interface DebugConfigLike {
  name: string;
  type: string;
  request: string;
  [key: string]: any;
}

export function createLLDBDebugConfig(
  name: string,
  executable: string,
  args: string[] = [],
  env: Map<string, string> = new Map()
): DebugConfigLike {
  return {
    name: name,
    type: "lldb",
    request: "launch",
    program: executable,
    cwd: "${workspaceFolder}",
    args: args,
    env: Object.fromEntries(env),
    sourceLanguages: ["chapel"],
  };
}

export function createCppdbgDebugConfig(
  name: string,
  executable: string,
  args: string[] = [],
  env: Map<string, string> = new Map()
): DebugConfigLike {
  return {
    name: name,
    type: "cppdbg",
    request: "launch",
    program: executable,
    cwd: "${workspaceFolder}",
    args: args,
    environment: [...Array.from(env.entries()).map(([key, value]) => ({ name: key, value: value }))],
    stopAtEntry: false,
    linux: {
      MIMode: "gdb",
    },
    osx: {
      MIMode: "lldb",
    },
  };
}

export function executablePathsForFile(
  fileName: string,
  wsPath: string | undefined
): { executablePath: string; niceName: string; relPath: string } | undefined {
  const executablePath = fileName?.split(".").slice(0, -1).join(".");
  if (!executablePath) {
    return undefined;
  }
  let niceName: string = executablePath.split("/").pop() || executablePath;
  let relPath: string = executablePath;
  if (wsPath) {
    niceName = executablePath.replace(wsPath + "/", "");
    relPath = "${workspaceFolder}/" + niceName;
  }
  return { executablePath, niceName, relPath };
}
