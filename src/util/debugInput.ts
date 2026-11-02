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

export function parseArgsInput(input: string | undefined): string[] {
  return input ? input.split(",").map((arg: string) => arg.trim()) : [];
}

export function parseEnvInput(input: string | undefined): Map<string, string> {
  const envMap = new Map<string, string>();
  if (input) {
    const envArray = input.split(",").map((envVar: string) => envVar.trim());
    for (const envVar of envArray) {
      const [key, value] = envVar.split("=");
      if (key && value) {
        envMap.set(key.trim(), value.trim());
      }
    }
  }
  return envMap;
}

// mutates and returns `user`, adding entries from `base` that `user` lacks
export function mergeEnvPreferUser(
  user: Map<string, string>,
  base: Map<string, string>
): Map<string, string> {
  for (const [key, value] of base) {
    if (!user.has(key)) {
      user.set(key, value);
    }
  }
  return user;
}
