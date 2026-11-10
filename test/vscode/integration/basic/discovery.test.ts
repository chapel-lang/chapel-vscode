import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { ChapelExtensionApi } from "../../../../src/extension";
import { activateExtension } from "../../helpers/api";
import {
  ClientState,
  chplHome,
  findOnPath,
  restoreSettingsAndRestart,
  setSettingAndRestart,
  requireChapel,
  startServers,
} from "../../helpers/chapel";

describe("tool discovery", () => {
  let api: ChapelExtensionApi;
  let tmpDir: string | undefined;

  before(async () => {
    requireChapel();
    api = await activateExtension();
  });

  afterEach(async () => {
    await restoreSettingsAndRestart(api);
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("finds both tools on PATH with default settings", async () => {
    await startServers(api, "A.chpl");
    assert.strictEqual(api.chplcheck.tool_path, findOnPath("chplcheck"));
    assert.strictEqual(api.cls.tool_path, findOnPath("chpl-language-server"));
  });

  it("uses the tools from chapel.CHPL_HOME", async () => {
    await startServers(api, "A.chpl");
    const home = chplHome();
    await setSettingAndRestart(api, "CHPL_HOME", home);
    assert.strictEqual(api.chplcheck.state, ClientState.RUNNING);
    assert.strictEqual(api.cls.state, ClientState.RUNNING);
    assert.strictEqual(
      api.chplcheck.tool_path,
      path.join(home, "tools", "chplcheck", "chplcheck")
    );
    assert.strictEqual(
      api.cls.tool_path,
      path.join(home, "tools", "chpl-language-server", "chpl-language-server")
    );
  });

  it("uses explicit tool paths from the settings", async () => {
    await startServers(api, "A.chpl");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chapel-tools-"));
    const wrappers: Record<string, string> = {};
    for (const tool of ["chplcheck", "chpl-language-server"]) {
      const real = findOnPath(tool);
      assert.ok(real);
      wrappers[tool] = path.join(tmpDir, tool);
      fs.writeFileSync(wrappers[tool], `#!/bin/sh\nexec "${real}" "$@"\n`, {
        mode: 0o755,
      });
    }
    await setSettingAndRestart(api, "chplcheck.path", wrappers["chplcheck"]);
    await setSettingAndRestart(
      api,
      "chpl-language-server.path",
      wrappers["chpl-language-server"]
    );
    assert.strictEqual(api.chplcheck.tool_path, wrappers["chplcheck"]);
    assert.strictEqual(api.cls.tool_path, wrappers["chpl-language-server"]);
    assert.strictEqual(api.chplcheck.state, ClientState.RUNNING);
    assert.strictEqual(api.cls.state, ClientState.RUNNING);
  });
});
