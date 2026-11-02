import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  checkChplHome,
  checkToolPath,
  findPossibleChplHomes,
  resolveToolPath,
  searchDirectoryForChplHome,
  searchPATH,
} from "../../../src/util/chplHome";

const chplHomeSubdirs = ["util", "compiler", "runtime", "modules", "tools"];

function makeFile(filePath: string): string {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "");
  return filePath;
}

function makeChplHome(dir: string, opts: { tools?: string[]; skip?: string } = {}): string {
  for (const subdir of chplHomeSubdirs) {
    if (subdir !== opts.skip) {
      fs.mkdirSync(path.join(dir, subdir), { recursive: true });
    }
  }
  for (const tool of opts.tools ?? []) {
    makeFile(path.join(dir, "tools", tool, tool));
  }
  return dir;
}

function pathEnv(...dirs: string[]): string {
  return dirs.join(path.delimiter);
}

describe("util/chplHome", () => {
  let tmp: string;

  beforeEach(() => {
    // realpath so expectations match on macOS, where tmpdir is behind a symlink
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "chapel-vscode-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe("checkChplHome", () => {
    it("reports an unset CHPL_HOME", () => {
      assert.strictEqual(checkChplHome(undefined), "CHPL_HOME is not set");
      assert.strictEqual(checkChplHome(""), "CHPL_HOME is not set");
    });

    it("reports a nonexistent CHPL_HOME", () => {
      const missing = path.join(tmp, "missing");
      assert.strictEqual(checkChplHome(missing), `CHPL_HOME (${missing}) does not exist`);
    });

    it("reports a CHPL_HOME that is a file", () => {
      const file = makeFile(path.join(tmp, "file"));
      assert.strictEqual(checkChplHome(file), `CHPL_HOME (${file}) does not exist`);
    });

    it("reports a relative CHPL_HOME", () => {
      const rel = path.relative(process.cwd(), makeChplHome(path.join(tmp, "home")));
      assert.ok(!path.isAbsolute(rel));
      assert.strictEqual(checkChplHome(rel), `CHPL_HOME (${rel}) is not an absolute path`);
    });

    it("reports a directory missing any required subdir", () => {
      for (const subdir of chplHomeSubdirs) {
        const home = makeChplHome(path.join(tmp, `no-${subdir}`), { skip: subdir });
        assert.strictEqual(checkChplHome(home), `CHPL_HOME (${home}) is not a Chapel directory`, subdir);
      }
    });

    it("reports a required subdir that is a file", () => {
      const home = makeChplHome(path.join(tmp, "home"), { skip: "runtime" });
      makeFile(path.join(home, "runtime"));
      assert.strictEqual(checkChplHome(home), `CHPL_HOME (${home}) is not a Chapel directory`);
    });

    it("accepts a valid CHPL_HOME", () => {
      assert.strictEqual(checkChplHome(makeChplHome(path.join(tmp, "home"))), undefined);
    });

    it("does not require a frontend directory (807d674)", () => {
      const home = makeChplHome(path.join(tmp, "home"));
      assert.ok(!fs.existsSync(path.join(home, "frontend")));
      assert.strictEqual(checkChplHome(home), undefined);
    });
  });

  describe("checkToolPath", () => {
    it("reports an empty path", () => {
      assert.strictEqual(checkToolPath(""), "Path is empty");
    });

    it("reports a nonexistent path", () => {
      const missing = path.join(tmp, "chplcheck");
      assert.strictEqual(checkToolPath(missing), `${missing} does not exist`);
    });

    it("reports a directory", () => {
      assert.strictEqual(checkToolPath(tmp), `${tmp} does not exist`);
    });

    it("accepts an existing file", () => {
      assert.strictEqual(checkToolPath(makeFile(path.join(tmp, "chplcheck"))), undefined);
    });
  });

  describe("searchPATH", () => {
    it("calls back for each matching file in PATH order", () => {
      const a = makeFile(path.join(tmp, "a", "chpl"));
      fs.mkdirSync(path.join(tmp, "b", "chpl"), { recursive: true });
      const c = makeFile(path.join(tmp, "c", "chpl"));
      const found: string[] = [];
      searchPATH("chpl", (p) => {
        found.push(p);
      }, pathEnv(path.join(tmp, "a"), path.join(tmp, "missing"), path.join(tmp, "b"), path.join(tmp, "c")));
      assert.deepStrictEqual(found, [a, c]);
    });

    it("stops when the callback returns true", () => {
      const a = makeFile(path.join(tmp, "a", "chpl"));
      makeFile(path.join(tmp, "b", "chpl"));
      const found: string[] = [];
      searchPATH("chpl", (p) => {
        found.push(p);
        return true;
      }, pathEnv(path.join(tmp, "a"), path.join(tmp, "b")));
      assert.deepStrictEqual(found, [a]);
    });

    it("finds nothing with an empty PATH", () => {
      const found: string[] = [];
      searchPATH("chpl", (p) => {
        found.push(p);
      }, "");
      assert.deepStrictEqual(found, []);
    });
  });

  describe("resolveToolPath", () => {
    let home: string;
    let binDir: string;
    let onPath: string;

    beforeEach(() => {
      home = makeChplHome(path.join(tmp, "home"), { tools: ["chplcheck"] });
      binDir = path.join(tmp, "bin");
      onPath = makeFile(path.join(binDir, "chplcheck"));
    });

    it("prefers the configured path, without checking it", () => {
      assert.strictEqual(
        resolveToolPath("chplcheck", "/configured/chplcheck", home, pathEnv(binDir)),
        "/configured/chplcheck"
      );
    });

    it("uses $CHPL_HOME/tools/<tool>/<tool> before PATH", () => {
      assert.strictEqual(
        resolveToolPath("chplcheck", "", home, pathEnv(binDir)),
        path.join(home, "tools", "chplcheck", "chplcheck")
      );
      assert.strictEqual(
        resolveToolPath("chplcheck", undefined, home, pathEnv(binDir)),
        path.join(home, "tools", "chplcheck", "chplcheck")
      );
    });

    it("falls back to PATH when the tool is not in CHPL_HOME", () => {
      fs.rmSync(path.join(home, "tools", "chplcheck"), { recursive: true });
      assert.strictEqual(resolveToolPath("chplcheck", undefined, home, pathEnv(binDir)), onPath);
    });

    it("falls back to PATH when CHPL_HOME is invalid or unset", () => {
      fs.rmSync(path.join(home, "runtime"), { recursive: true });
      assert.strictEqual(resolveToolPath("chplcheck", undefined, home, pathEnv(binDir)), onPath);
      assert.strictEqual(resolveToolPath("chplcheck", undefined, undefined, pathEnv(binDir)), onPath);
    });

    it("returns undefined when the tool is not found", () => {
      const emptyDir = path.join(tmp, "empty");
      fs.mkdirSync(emptyDir);
      assert.strictEqual(resolveToolPath("chpl-language-server", undefined, home, pathEnv(emptyDir)), undefined);
    });
  });

  describe("searchDirectoryForChplHome", () => {
    it("returns the directory itself if it is a CHPL_HOME", () => {
      const home = makeChplHome(path.join(tmp, "home"));
      assert.deepStrictEqual(searchDirectoryForChplHome(home), [home]);
    });

    it("only looks at the directory itself with the default depth", () => {
      makeChplHome(path.join(tmp, "home"));
      assert.deepStrictEqual(searchDirectoryForChplHome(tmp), []);
    });

    it("finds homes in subdirectories up to the given depth", () => {
      const a = makeChplHome(path.join(tmp, "a"));
      const b = makeChplHome(path.join(tmp, "b"));
      fs.mkdirSync(path.join(tmp, "not-a-home"));
      makeFile(path.join(tmp, "file"));
      const deep = makeChplHome(path.join(tmp, "c", "chapel-2.5.0"));

      assert.deepStrictEqual(searchDirectoryForChplHome(tmp, 2).sort(), [a, b]);
      assert.deepStrictEqual(searchDirectoryForChplHome(tmp, 3).sort(), [a, b, deep]);
    });

    it("returns nothing for depth 0", () => {
      assert.deepStrictEqual(searchDirectoryForChplHome(makeChplHome(path.join(tmp, "home")), 0), []);
    });

    it("does not search inside a found home", () => {
      const home = makeChplHome(path.join(tmp, "home"));
      makeChplHome(path.join(home, "nested"));
      assert.deepStrictEqual(searchDirectoryForChplHome(tmp, 3), [home]);
    });

    it("returns nothing for a nonexistent directory", () => {
      assert.deepStrictEqual(searchDirectoryForChplHome(path.join(tmp, "missing"), 3), []);
    });
  });

  describe("findPossibleChplHomes", () => {
    let emptyDir: string;

    beforeEach(() => {
      emptyDir = path.join(tmp, "empty");
      fs.mkdirSync(emptyDir);
    });

    it("finds CHPL_HOME from the environment", () => {
      const home = makeChplHome(path.join(tmp, "home"));
      assert.deepStrictEqual(findPossibleChplHomes({ CHPL_HOME: home, PATH: emptyDir }, []), [home]);
    });

    it("ignores an invalid CHPL_HOME", () => {
      assert.deepStrictEqual(findPossibleChplHomes({ CHPL_HOME: emptyDir, PATH: emptyDir }, []), []);
    });

    it("finds a home from $CHPL_HOME/bin/chpl on PATH", () => {
      const home = makeChplHome(path.join(tmp, "home"));
      makeFile(path.join(home, "bin", "chpl"));
      const found = findPossibleChplHomes({ PATH: pathEnv(emptyDir, path.join(home, "bin")) }, []);
      assert.deepStrictEqual(found, [home]);
    });

    it.skip("finds a home from $CHPL_HOME/bin/<platform>/chpl on PATH (#148)", () => {
      const home = makeChplHome(path.join(tmp, "home"));
      const platformBin = path.join(home, "bin", "linux64-x86_64");
      makeFile(path.join(platformBin, "chpl"));
      assert.deepStrictEqual(findPossibleChplHomes({ PATH: platformBin }, []), [home]);
    });

    it.skip("finds a home from a symlink to chpl elsewhere on PATH (#148)", () => {
      const home = makeChplHome(path.join(tmp, "home"));
      const chpl = makeFile(path.join(home, "bin", "chpl"));
      const linkDir = path.join(tmp, "links");
      fs.mkdirSync(linkDir);
      fs.symlinkSync(chpl, path.join(linkDir, "chpl"));
      assert.deepStrictEqual(findPossibleChplHomes({ PATH: linkDir }, []), [home]);
    });

    it("finds homes in dirsToCheck", () => {
      const root = path.join(tmp, "opt");
      const home = makeChplHome(path.join(root, "chapel"));
      assert.deepStrictEqual(findPossibleChplHomes({ PATH: emptyDir }, [root, path.join(tmp, "missing")]), [home]);
    });

    it("lists a home found in the env and on PATH once", () => {
      const home = makeChplHome(path.join(tmp, "home"));
      makeFile(path.join(home, "bin", "chpl"));
      const found = findPossibleChplHomes({ CHPL_HOME: home, PATH: path.join(home, "bin") }, []);
      assert.deepStrictEqual(found, [home]);
    });

    it.skip("lists a home found in the env and in dirsToCheck once (#154)", () => {
      const root = path.join(tmp, "opt");
      const home = makeChplHome(path.join(root, "chapel"));
      const found = findPossibleChplHomes({ CHPL_HOME: home, PATH: emptyDir }, [root]);
      assert.deepStrictEqual(found, [home]);
    });
  });
});
