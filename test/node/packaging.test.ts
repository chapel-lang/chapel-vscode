import * as assert from "assert";
import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "path";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const wrappers = [
  "wrappers/chpl",
  "wrappers/mason",
  "wrappers/conditional-build-run",
];

describe("packaging", () => {
  let packaged: string[] = [];

  before(function () {
    this.timeout(120000);
    const output = childProcess.execSync("npx vsce ls", {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120000,
    });
    packaged = output.split(/\r?\n/).filter((line) => line.length > 0);
  });

  for (const file of [
    ...wrappers,
    "syntaxes/chapel.tmLanguage.json",
    "snippets/chapel.json",
    "package.json",
  ]) {
    it(`includes ${file}`, () => {
      assert.ok(packaged.includes(file));
    });
  }

  it("includes dist/extension.js once it has been built", function () {
    if (!fs.existsSync(path.join(repoRoot, "dist", "extension.js"))) {
      this.skip();
    }
    assert.ok(packaged.includes("dist/extension.js"));
  });

  for (const dir of ["src/", "test/", "out/", ".vscode-test/", "node_modules/", ".github/"]) {
    it(`excludes ${dir}`, () => {
      assert.deepStrictEqual(
        packaged.filter((f) => f.startsWith(dir)),
        []
      );
    });
  }

  it("wrappers are executable in git", () => {
    const output = childProcess.execFileSync(
      "git",
      ["ls-files", "-s", "--", ...wrappers],
      { cwd: repoRoot, encoding: "utf8" }
    );
    const modes = new Map(
      output
        .trim()
        .split(/\r?\n/)
        .map((line) => {
          const [info, file] = line.split("\t");
          return [file, info.split(" ")[0]];
        })
    );
    for (const wrapper of wrappers) {
      assert.strictEqual(modes.get(wrapper), "100755", wrapper);
    }
  });
});
