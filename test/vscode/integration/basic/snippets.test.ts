import * as assert from "assert";
import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getExtension } from "../../helpers/api";
import { skipWithoutChapel } from "../../helpers/chapel";

interface Snippet {
  body: string | string[];
}

const snippets: Record<string, Snippet> = JSON.parse(
  fs.readFileSync(path.join(getExtension().extensionPath, "snippets", "chapel.json"), "utf8")
);

// Values for tabstops that stand for more than an identifier
const TABSTOP_VALUES: Record<string, Record<string, string>> = {
  use: { 1: "IO" },
  union: { 2: "a: int", 3: "b: real" },
};

const asType = (body: string) => `var v: ${body};`;
const asExpression = (body: string) => `const v = ${body};`;
const inRecord = (body: string) => `record R {\n${body}\n}`;
const inClass = (body: string) => `class C {\n${body}\n}`;

// Code around the snippets that are not statements or declarations on their own
const CONTEXTS: Record<string, (body: string) => string> = {
  type: (body) => `${body} t = int;`,
  bool: asType,
  int: asType,
  uint: asType,
  real: asType,
  imag: asType,
  complex: asType,
  string: asType,
  range: asExpression,
  openrange: asExpression,
  by: asExpression,
  counted: asExpression,
  align: asExpression,
  Locales: asExpression,
  "UnitTest-test-named": (body) => `proc t${body}`,
  "serialize-record": inRecord,
  "deserialize-record": inRecord,
  contextManager: inRecord,
  "serialize-class": inClass,
  "deserialize-class": inClass,
};

// Snippets that are invalid Chapel whatever identifiers the tabstops get
const BROKEN: Record<string, string> = {
  "ifelse-single": "#162",
  select: "#162",
};

function render(name: string, snippet: Snippet): string {
  const values = TABSTOP_VALUES[name] ?? {};
  const body = (Array.isArray(snippet.body) ? snippet.body : [snippet.body])
    // A tabstop on a line of its own is a block body, which may be empty
    .map((line) => (/^\s*\$(\d+|\{\d+\})\s*$/.test(line) ? "" : line))
    .join("\n")
    .replace(/\$\{\d+:([^}]*)\}/g, "$1")
    .replace(/\$\{\d+\|([^,|]*)[^}]*\}/g, "$1")
    .replace(/\$(?:(\d+)|\{(\d+)\})/g, (_, bare: string | undefined, braced: string | undefined) => {
      const n = bare ?? braced!;
      return n === "0" ? "" : values[n] ?? `x${n}`;
    });
  return (CONTEXTS[name] ?? ((b: string) => b))(body);
}

// Resolves with chpl's output if the file does not parse
function parseErrors(file: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile("chpl", ["--parse-only", file], (error, stdout, stderr) => {
      resolve(error ? `${stdout}${stderr}` || error.message : undefined);
    });
  });
}

describe("snippets parse with chpl", () => {
  let dir: string | undefined;
  const results = new Map<string, { source: string; errors: string | undefined }>();

  before(async function () {
    skipWithoutChapel(this);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "chapel-snippets-"));
    const pending = Object.keys(snippets);
    const worker = async () => {
      for (let name = pending.shift(); name !== undefined; name = pending.shift()) {
        // Each file is a module named after it, so the name must be an identifier
        const file = path.join(dir!, `snippet_${name.replace(/\W/g, "_")}.chpl`);
        const source = render(name, snippets[name]);
        fs.writeFileSync(file, source + "\n");
        results.set(name, { source, errors: await parseErrors(file) });
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, worker));
  });

  after(() => {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const name of Object.keys(snippets)) {
    const broken: string | undefined = BROKEN[name];
    const test = broken ? it.skip : it;
    test(broken ? `${name} (${broken})` : name, () => {
      const result = results.get(name);
      assert.ok(result, `${name} was not parsed`);
      assert.ok(result.errors === undefined, `${result.source}\n\n${result.errors}`);
    });
  }
});
