import * as assert from "assert";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getExtension } from "../../helpers/api";
import { skipWithoutChapel } from "../../helpers/chapel";

interface ProblemPattern {
  regexp: string;
  file: number;
  line: number;
  severity: number;
  message: number;
}

interface Problem {
  file: string;
  line: number;
  severity: string;
  message: string;
}

// The lines of `output` that the chpl-compiler problem matcher from package.json turns into problems
function problems(output: string): Problem[] {
  const matchers: { name: string; pattern: ProblemPattern[] }[] =
    getExtension().packageJSON.contributes.problemMatchers;
  const matcher = matchers.find((m) => m.name === "chpl-compiler");
  assert.ok(matcher, "no chpl-compiler problem matcher in package.json");
  const pattern = matcher.pattern[0];
  const regexp = new RegExp(pattern.regexp);
  return output.split("\n").flatMap((line) => {
    const match = regexp.exec(line);
    if (!match) {
      return [];
    }
    return [{
      file: match[pattern.file],
      line: Number(match[pattern.line]),
      severity: match[pattern.severity],
      message: match[pattern.message],
    }];
  });
}

describe("chpl-compiler problem matcher", () => {
  let dir: string | undefined;

  function writeSource(name: string, lines: string[]): string {
    const file = path.join(dir!, name);
    fs.writeFileSync(file, lines.join("\n") + "\n");
    return file;
  }

  before(function () {
    skipWithoutChapel(this);
    dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "chapel-problems-"));
  });

  after(() => {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("matches the errors and warnings that chpl reports", () => {
    const file = writeSource("Diagnostics.chpl", [
      "proc takesInt(x: int) { }",
      "",
      "proc main() {",
      "  compilerWarning(\"a warning from the test\", 0);",
      "  takesInt(\"not an int\");",
      "}",
    ]);
    const result = spawnSync("chpl", [file, "-o", path.join(dir!, "Diagnostics")], { encoding: "utf8" });
    assert.notStrictEqual(result.status, 0, result.stderr);

    const found = problems(result.stderr).sort((a, b) => a.line - b.line);
    assert.deepStrictEqual(
      found.map((p) => [p.file, p.line, p.severity]),
      [[file, 4, "warning"], [file, 5, "error"]],
      result.stderr
    );
    assert.strictEqual(found[0].message, "a warning from the test");
  });

  it.skip("matches syntax errors (#161)", () => {
    const file = writeSource("SyntaxError.chpl", ["var x = ;"]);
    const result = spawnSync("chpl", ["--parse-only", file], { encoding: "utf8" });
    assert.notStrictEqual(result.status, 0, result.stderr);

    assert.deepStrictEqual(
      problems(result.stderr).map((p) => [p.file, p.line, p.severity]),
      [[file, 1, "error"]],
      result.stderr
    );
  });
});
