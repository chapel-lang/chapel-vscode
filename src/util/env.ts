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

export function computeEnvAffectingChapel(
  processEnv: NodeJS.ProcessEnv,
  opts: {
    chplHome: string | undefined;
    chplDeveloper: boolean | undefined;
    baseEnv: Map<string, string>;
  },
  extraGlobs?: string[]
): Map<string, string> {
  const base_globs = [
    "CHPL_.*",
    "CHPL_RT_.*",
    "FI_.*",
    "GASNET_.*",
    "SLURM_.*",
    "PBS_.*",
    "QTHREAD_.*",
    "QT_.*",
    "ASAN_OPTIONS",
  ];
  // TODO: consider including?
  // PKG_CONFIG_PATH
  // HUGETLB_NO_RESERVE
  // MASON_REGISTRY
  // SPACK_ROOT
  // PYTHON*
  // LD_LIBRARY_PATH
  // DYLD_LIBRARY_PATH
  const globs = base_globs.concat(extraGlobs ?? []);
  const regex = new RegExp(`^(${globs.join("|")})$`);

  let env = new Map();
  for (const e in processEnv) {
    if (regex.test(e)) {
      env.set(e, processEnv[e] ?? "");
    }
  }

  // special handling for CHPL_HOME and CHPL_DEVELOPER
  const chplhome = opts.chplHome;
  if (chplhome !== undefined && chplhome !== "") {
    env.set("CHPL_HOME", chplhome);
  } else if (processEnv["CHPL_HOME"] !== undefined) {
    env.set("CHPL_HOME", processEnv["CHPL_HOME"]);
  }
  const chpldev = opts.chplDeveloper;
  if (chpldev !== undefined && chpldev) {
    env.set("CHPL_DEVELOPER", "1");
  } else if (processEnv["CHPL_DEVELOPER"] !== undefined) {
    env.set("CHPL_DEVELOPER", processEnv["CHPL_DEVELOPER"]);
  }

  // set the values from chapel.baseEnv
  for (const [k, v] of opts.baseEnv) {
    env.set(k, v);
  }

  return env;
}
