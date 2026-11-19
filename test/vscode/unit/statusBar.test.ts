import * as assert from "assert";
import * as path from "path";
import { LanguageClientState } from "../../../src/ChapelLanguageClient";
import { activateExtension } from "../helpers/api";
import { isStatusBarVisible, trackStatusBar } from "../helpers/languageClients";
import { restoreSettings, setSetting } from "../helpers/settings";
import { waitFor } from "../helpers/wait";

describe("language client status bar", () => {
  afterEach(restoreSettings);

  it("does not error when a disabled server's tool is missing", async () => {
    const api = await activateExtension();
    assert.strictEqual(api.chplcheck.state, LanguageClientState.DISABLED);
    assert.strictEqual(api.cls.state, LanguageClientState.DISABLED);
  });

  it("hides the error item after disabling an errored server (#158)", async () => {
    const api = await activateExtension();
    const client = api.chplcheck;
    trackStatusBar(client);

    await setSetting("chplcheck.path", path.join(__dirname, "does-not-exist", "chplcheck"));
    await setSetting("chplcheck.enable", true);
    await waitFor(() => client.state === LanguageClientState.ERRORED, {
      message: "chplcheck to error",
    });
    assert.ok(isStatusBarVisible(client), "error item should be shown");

    await setSetting("chplcheck.enable", false);
    await waitFor(() => client.state === LanguageClientState.DISABLED, {
      message: "chplcheck to be disabled",
    });
    assert.ok(!isStatusBarVisible(client), "error item should be hidden");
  });
});
