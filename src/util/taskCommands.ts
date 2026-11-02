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

export function buildRunWrapperArgs(opts: {
  compiler: string;
  sourceFiles: string[];
  executable: string;
  compileArgs: string[];
  numLocales: string;
  runArgs: string[];
}): string[] {
  let buildCommand = `${opts.compiler} ${opts.sourceFiles.join(" ")} -o ${opts.executable}`;
  if (opts.compileArgs.length > 0) {
    buildCommand += ` ${opts.compileArgs.join(" ")}`;
  }
  let runCommand = `${opts.executable} --numLocales=${opts.numLocales}`;
  if (opts.runArgs.length > 0) {
    runCommand += ` ${opts.runArgs.join(" ")}`;
  }
  return [opts.sourceFiles.join(";"), opts.executable, buildCommand, runCommand];
}

export function runTaskArgs(numLocales: string, args: string[]): string[] {
  return [`--numLocales=${numLocales}`, ...args];
}

export function masonTestFileArgs(filename: string, filter?: string): string[] {
  const args: string[] = ["--show"];
  if (filter) {
    args.push(`--filter=${filter}`);
  }
  args.push("--");
  args.push(filename);
  return args;
}
