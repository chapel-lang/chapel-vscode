import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
);
const contributes = packageJson.contributes;

function parseSource(relativePath: string): ts.SourceFile {
  const file = path.join(repoRoot, relativePath);
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
}

function findCalls(node: ts.Node, name: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === name
    ) {
      calls.push(n);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return calls;
}

interface InterfaceProperty {
  name: string;
  optional: boolean;
}

function interfaceProperties(
  sourceFile: ts.SourceFile,
  interfaceName: string
): InterfaceProperty[] {
  const decl = sourceFile.statements.find(
    (s): s is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(s) && s.name.text === interfaceName
  );
  assert.ok(decl, `interface ${interfaceName} not found`);
  return decl.members
    .filter(ts.isPropertySignature)
    .map((m) => ({
      name: m.name.getText(sourceFile),
      optional: m.questionToken !== undefined,
    }))
    .filter((p) => p.name !== "type");
}

function contributedSettings(): string[] {
  const configs = Array.isArray(contributes.configuration)
    ? contributes.configuration
    : [contributes.configuration];
  return configs.flatMap((c: { properties?: object }) =>
    Object.keys(c.properties ?? {})
  );
}

function collectRelativePaths(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.startsWith("./")) {
      out.push(value);
    }
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectRelativePaths(v, out));
  } else if (value !== null && typeof value === "object") {
    Object.values(value).forEach((v) => collectRelativePaths(v, out));
  }
  return out;
}

describe("package.json manifest", () => {
  describe("settings read in src/configuration.ts", () => {
    const calls = findCalls(
      parseSource("src/configuration.ts"),
      "getConfigValue"
    );
    const keys = calls
      .map((c) => c.arguments[0])
      .filter(ts.isStringLiteral)
      .map((arg) => arg.text);
    const settings = contributedSettings();
    const knownBugs: Record<string, string> = { chplDeveloper: "#142" };

    it("reads every setting with a string literal key", () => {
      assert.ok(calls.length > 0);
      assert.strictEqual(keys.length, calls.length);
    });

    for (const key of keys) {
      const bug = knownBugs[key];
      const title = `"${key}" is contributed under chapel.${bug ? ` (${bug})` : ""}`;
      (bug ? it.skip : it)(title, () => {
        const full = `chapel.${key}`;
        const matches = settings.filter(
          (s) => s === full || s.startsWith(`${full}.`)
        );
        assert.ok(matches.length > 0, `no setting ${full} or ${full}.*`);
      });
    }
  });

  describe("task definitions match src/task.ts", () => {
    const taskSource = parseSource("src/task.ts");
    const interfacesByType: Record<string, string> = {
      "chpl": "ChplBuildTaskDefinition",
      "chpl-run": "ChplRunTaskDefinition",
      "chpl-build-run": "ChplBuildAndRunTaskDefinition",
      "mason": "MasonTaskDefinition",
    };
    const knownBugs: Record<string, string> = { "mason.mason": "#149" };

    it("contributes exactly the expected task types", () => {
      const types = contributes.taskDefinitions.map(
        (d: { type: string }) => d.type
      );
      assert.deepStrictEqual(
        [...types].sort(),
        Object.keys(interfacesByType).sort()
      );
    });

    for (const [type, interfaceName] of Object.entries(interfacesByType)) {
      describe(`"${type}" (${interfaceName})`, () => {
        const props = interfaceProperties(taskSource, interfaceName);
        const definition = contributes.taskDefinitions.find(
          (d: { type: string }) => d.type === type
        );
        const contributedProps = Object.keys(definition?.properties ?? {});

        for (const prop of props) {
          const bug = knownBugs[`${type}.${prop.name}`];
          const title = `contributes interface property "${prop.name}"${bug ? ` (${bug})` : ""}`;
          (bug ? it.skip : it)(title, () => {
            assert.ok(contributedProps.includes(prop.name));
          });
        }

        for (const name of contributedProps) {
          it(`declares contributed property "${name}" in the interface`, () => {
            assert.ok(props.some((p) => p.name === name));
          });
        }

        it("requires exactly the non-optional interface properties", () => {
          const required = props.filter((p) => !p.optional).map((p) => p.name);
          assert.deepStrictEqual(
            [...(definition?.required ?? [])].sort(),
            required.sort()
          );
        });
      });
    }
  });

  describe("commands", () => {
    const commands: { command: string; title?: string }[] =
      contributes.commands;
    const commandIds = new Set(commands.map((c) => c.command));

    it("every menu entry references a contributed command", () => {
      const menuCommands = Object.values(contributes.menus)
        .flat()
        .map((entry) => (entry as { command: string }).command);
      assert.ok(menuCommands.length > 0);
      assert.deepStrictEqual(
        menuCommands.filter((c) => !commandIds.has(c)),
        []
      );
    });

    it("every command has a title", () => {
      assert.deepStrictEqual(
        commands.filter((c) => !c.title?.trim()).map((c) => c.command),
        []
      );
    });
  });

  describe("referenced files", () => {
    it("main points at the esbuild bundle", () => {
      assert.strictEqual(packageJson.main, "./dist/extension.js");
    });

    const files = [packageJson.icon, ...collectRelativePaths(contributes)];

    it("references the expected contributed files", () => {
      for (const expected of [
        "./syntaxes/chapel.tmLanguage.json",
        "./snippets/chapel.json",
        "./chapel-language-configuration.json",
        "./instructions/mason-UnitTest.instructions.md",
        "./skills/chapel-mason-test/SKILL.md",
      ]) {
        assert.ok(files.includes(expected), expected);
      }
    });

    for (const file of new Set(files)) {
      it(`${file} exists`, () => {
        assert.ok(fs.statSync(path.join(repoRoot, file)).isFile());
      });
    }
  });
});
