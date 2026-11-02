import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { activateExtension } from "../helpers/api";
import { workspaceUri } from "../helpers/chapel";
import { restoreSettings, setSetting } from "../helpers/settings";
import { sleep, waitFor } from "../helpers/wait";

const CPPTOOLS = "ms-vscode.cpptools";
const CODELLDB = "vadimcn.vscode-lldb";
// Long enough for a command that should not write launch.json to have written it
const SETTLE_MS = 500;

describe("debug configuration commands", () => {
  let originalConfigs: unknown;
  let tmp: string;
  let showInput: sinon.SinonStub;
  let showError: sinon.SinonStub;
  let showInfo: sinon.SinonStub;

  function launchSection(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("launch");
  }

  function launchConfigs(): vscode.DebugConfiguration[] {
    return launchSection().get<vscode.DebugConfiguration[]>("configurations") ?? [];
  }

  async function setLaunchConfigs(configs: unknown): Promise<void> {
    await launchSection().update("configurations", configs, vscode.ConfigurationTarget.Workspace);
  }

  function configNamed(name: string): vscode.DebugConfiguration {
    const config = launchConfigs().find((c) => c.name === name);
    assert.ok(config, `no launch configuration named ${name}`);
    return config;
  }

  function environmentOf(config: vscode.DebugConfiguration): Map<string, string> {
    const environment: { name: string; value: string }[] = config.environment;
    return new Map(environment.map((e) => [e.name, e.value]));
  }

  // Answers the input boxes in order: name, executable, args, env (args and env for the active file)
  function answerInputs(...answers: (string | undefined)[]): void {
    answers.forEach((answer, i) => showInput.onCall(i).resolves(answer));
  }

  function installProviders(): void {
    const getExtension = sinon.stub(vscode.extensions, "getExtension").callThrough();
    for (const id of [CPPTOOLS, CODELLDB]) {
      getExtension.withArgs(id).returns({ id } as vscode.Extension<unknown>);
    }
  }

  // The command returns before launch.json is written; the success message comes after
  async function runAndWaitForSave(command: string): Promise<vscode.DebugConfiguration[]> {
    await vscode.commands.executeCommand(command);
    await waitFor(() => showInfo.called, { message: "the success message" });
    return launchConfigs();
  }

  async function runAndSettle(command: string): Promise<void> {
    await vscode.commands.executeCommand(command);
    await sleep(SETTLE_MS);
  }

  before(async () => {
    await activateExtension();
    originalConfigs = launchSection().inspect("configurations")?.workspaceValue;
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "chapel-debug-"));
    fs.writeFileSync(path.join(tmp, "outside.chpl"), "writeln(\"outside\");\n");
    fs.writeFileSync(path.join(tmp, "notes.txt"), "not Chapel\n");
  });

  beforeEach(() => {
    showInput = sinon.stub(vscode.window, "showInputBox").resolves(undefined);
    showError = sinon.stub(vscode.window, "showErrorMessage").resolves(undefined);
    showInfo = sinon.stub(vscode.window, "showInformationMessage").resolves(undefined);
  });

  afterEach(async () => {
    sinon.restore();
    await setLaunchConfigs(originalConfigs);
    await restoreSettings();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  for (const id of [CPPTOOLS, CODELLDB]) {
    it(`links to the install page when ${id} is preferred but not installed`, async () => {
      await setSetting("preferredDebugProvider", id);
      await runAndSettle("chapel.createDebugConfig");

      sinon.assert.calledOnce(showError);
      const message: string = showError.firstCall.args[0];
      assert.ok(message.includes(`'${id}' is not installed`), message);
      assert.ok(message.includes(`(command:extension.open?%22${id}%22)`), message);
      sinon.assert.notCalled(showInput);
      assert.deepStrictEqual(launchConfigs(), []);
    });
  }

  describe("with the debugger extensions installed", () => {
    beforeEach(() => {
      installProviders();
    });

    it("writes a cppdbg configuration by default", async () => {
      answerInputs("Run prog", "/path/to/prog", "a, b", "FOO=1, BAR=2");
      await runAndWaitForSave("chapel.createDebugConfig");

      const config = configNamed("Run prog");
      assert.strictEqual(config.type, "cppdbg");
      assert.strictEqual(config.request, "launch");
      assert.strictEqual(config.program, "/path/to/prog");
      assert.deepStrictEqual(config.args, ["a", "b"]);
      const environment = environmentOf(config);
      assert.strictEqual(environment.get("FOO"), "1");
      assert.strictEqual(environment.get("BAR"), "2");
      assert.strictEqual(config.osx.MIMode, "lldb");
      assert.strictEqual(config.linux.MIMode, "gdb");
      sinon.assert.calledWith(showInfo, "Debug configuration 'Run prog' created successfully.");
    });

    it("writes a CodeLLDB configuration when CodeLLDB is preferred", async () => {
      await setSetting("preferredDebugProvider", CODELLDB);
      answerInputs("Run prog", "/path/to/prog", "a, b", "FOO=1, BAR=2");
      await runAndWaitForSave("chapel.createDebugConfig");

      const config = configNamed("Run prog");
      assert.strictEqual(config.type, "lldb");
      assert.strictEqual(config.request, "launch");
      assert.strictEqual(config.program, "/path/to/prog");
      assert.deepStrictEqual(config.args, ["a", "b"]);
      assert.strictEqual(config.env.FOO, "1");
      assert.strictEqual(config.env.BAR, "2");
      assert.deepStrictEqual(config.sourceLanguages, ["chapel"]);
    });

    it("writes nothing when the name input is cancelled", async () => {
      await runAndSettle("chapel.createDebugConfig");

      sinon.assert.calledOnce(showInput);
      sinon.assert.notCalled(showInfo);
      assert.deepStrictEqual(launchConfigs(), []);
    });

    it("writes nothing when the executable input is cancelled", async () => {
      answerInputs("Run prog", undefined);
      await runAndSettle("chapel.createDebugConfig");

      sinon.assert.calledTwice(showInput);
      sinon.assert.notCalled(showInfo);
      assert.deepStrictEqual(launchConfigs(), []);
    });

    it.skip("keeps '=' in environment variable values (#146)", async () => {
      answerInputs("Run prog", "/path/to/prog", undefined, "KEY=a=b");
      await runAndWaitForSave("chapel.createDebugConfig");

      assert.strictEqual(environmentOf(configNamed("Run prog")).get("KEY"), "a=b");
    });

    it.skip("passes no arguments for whitespace-only input (#155)", async () => {
      answerInputs("Run prog", "/path/to/prog", "   ");
      await runAndWaitForSave("chapel.createDebugConfig");

      assert.deepStrictEqual(configNamed("Run prog").args, []);
    });

    describe("for the active file", () => {
      it("names the configuration after the Chapel file", async () => {
        await vscode.window.showTextDocument(workspaceUri("hello.chpl"));
        await runAndWaitForSave("chapel.createDebugConfigForActiveFile");

        const config = configNamed("Debug hello");
        assert.strictEqual(config.type, "cppdbg");
        assert.strictEqual(config.program, "${workspaceFolder}/hello");
        sinon.assert.calledTwice(showInput);
      });

      it("shows an error for a non-Chapel file", async () => {
        await vscode.window.showTextDocument(vscode.Uri.file(path.join(tmp, "notes.txt")));
        await runAndSettle("chapel.createDebugConfigForActiveFile");

        sinon.assert.calledWith(showError, "The current file is not a Chapel file.");
        sinon.assert.notCalled(showInput);
        assert.deepStrictEqual(launchConfigs(), []);
      });

      it.skip("uses the absolute path of a file outside the workspace (#147)", async () => {
        await vscode.window.showTextDocument(vscode.Uri.file(path.join(tmp, "outside.chpl")));
        const configs = await runAndWaitForSave("chapel.createDebugConfigForActiveFile");

        assert.strictEqual(configs.length, 1);
        assert.strictEqual(configs[0].program, path.join(tmp, "outside"));
      });
    });

    describe("when a configuration with the same name exists", () => {
      const existing = { name: "Existing", type: "cppdbg", request: "launch", program: "/path/to/old" };

      beforeEach(async () => {
        await setLaunchConfigs([existing]);
        answerInputs("Existing", "/path/to/new");
      });

      it("replaces it when the user chooses Overwrite", async () => {
        showError.resolves("Overwrite");
        const configs = await runAndWaitForSave("chapel.createDebugConfig");

        sinon.assert.calledWith(
          showError,
          "A debug configuration named 'Existing' already exists.",
          "Cancel",
          "Overwrite"
        );
        assert.strictEqual(configs.length, 1);
        assert.strictEqual(configs[0].program, "/path/to/new");
      });

      it.skip("keeps it and reports no success when the user chooses Cancel (#145)", async () => {
        showError.resolves("Cancel");
        await runAndSettle("chapel.createDebugConfig");

        sinon.assert.calledOnce(showError);
        assert.deepStrictEqual(launchConfigs(), [existing]);
        sinon.assert.notCalled(showInfo);
      });

      it.skip("keeps it when the prompt is dismissed (#145)", async () => {
        await runAndSettle("chapel.createDebugConfig");

        sinon.assert.calledOnce(showError);
        assert.deepStrictEqual(launchConfigs(), [existing]);
      });
    });
  });
});
