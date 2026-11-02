import * as assert from "assert";
import { parseChplHomeLink } from "../../../src/util/terminalLinks";

describe("util/terminalLinks", () => {
  const home = "/opt/chapel";

  it("parses a path and line number from a compiler error", () => {
    const link = "$CHPL_HOME/modules/standard/IO.chpl:123";
    assert.deepStrictEqual(
      parseChplHomeLink(`${link}: error: something went wrong`, home),
      {
        startIndex: 0,
        length: link.length,
        path: "/opt/chapel/modules/standard/IO.chpl",
        lineNum: 123,
      }
    );
  });

  it("includes a column number in the link but ignores it for lineNum", () => {
    const link = "$CHPL_HOME/modules/standard/IO.chpl:12:5";
    assert.deepStrictEqual(parseChplHomeLink(`${link}: note: here`, home), {
      startIndex: 0,
      length: link.length,
      path: "/opt/chapel/modules/standard/IO.chpl",
      lineNum: 12,
    });
  });

  it("uses -1 when there is no line number", () => {
    const link = "$CHPL_HOME/modules/standard/IO.chpl";
    assert.deepStrictEqual(parseChplHomeLink(`see ${link} for details`, home), {
      startIndex: 4,
      length: link.length,
      path: "/opt/chapel/modules/standard/IO.chpl",
      lineNum: -1,
    });
  });

  it("does not include a trailing colon without a number", () => {
    const parsed = parseChplHomeLink("$CHPL_HOME/modules/internal/ChapelBase.chpl: In function 'foo':", home);
    assert.strictEqual(parsed?.path, "/opt/chapel/modules/internal/ChapelBase.chpl");
    assert.strictEqual(parsed?.length, "$CHPL_HOME/modules/internal/ChapelBase.chpl".length);
    assert.strictEqual(parsed?.lineNum, -1);
  });

  it("links non-.chpl files under $CHPL_HOME", () => {
    const parsed = parseChplHomeLink("$CHPL_HOME/runtime/include/chpl-comm.h:42: warning: x", home);
    assert.strictEqual(parsed?.path, "/opt/chapel/runtime/include/chpl-comm.h");
    assert.strictEqual(parsed?.lineNum, 42);
  });

  it("reports the start index of a link after other text", () => {
    const prefix = "In file included from ";
    const link = "$CHPL_HOME/modules/standard/List.chpl:7";
    const parsed = parseChplHomeLink(`${prefix}${link}:`, home);
    assert.strictEqual(parsed?.startIndex, prefix.length);
    assert.strictEqual(parsed?.length, link.length);
    assert.strictEqual(parsed?.lineNum, 7);
  });

  it("leaves $CHPL_HOME in the path when chplHome is undefined", () => {
    const parsed = parseChplHomeLink("$CHPL_HOME/modules/standard/IO.chpl:1", undefined);
    assert.strictEqual(parsed?.path, "$CHPL_HOME/modules/standard/IO.chpl");
  });

  it("leaves $CHPL_HOME in the path when chplHome is empty", () => {
    const parsed = parseChplHomeLink("$CHPL_HOME/modules/standard/IO.chpl:1", "");
    assert.strictEqual(parsed?.path, "$CHPL_HOME/modules/standard/IO.chpl");
  });

  it("returns undefined when there is no $CHPL_HOME link", () => {
    assert.strictEqual(parseChplHomeLink("hello.chpl:3: error: bad", home), undefined);
    assert.strictEqual(parseChplHomeLink("", home), undefined);
  });
});
