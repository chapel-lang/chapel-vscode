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

export function parseToolVersion(output: string): string | undefined {
  const match = output.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : undefined;
}

export function meetsMinVersion(version: string, minVersion: string): boolean {
  const parts = version.split(".").map(Number);
  const minParts = minVersion.split(".").map(Number);
  for (let i = 0; i < Math.max(parts.length, minParts.length); i++) {
    const a = parts[i] ?? 0;
    const b = minParts[i] ?? 0;
    if (a > b) { return true; };
    if (a < b) { return false; };
  }
  return true;
}
