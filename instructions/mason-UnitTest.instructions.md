---
name: 'Chapel mason UnitTest Guidelines'
description: "Use when writing, editing, or reviewing Chapel UnitTests for mason projects (test/**/*.chpl). Covers the UnitTest module, assertions, setup/teardown with dependsOn and defer, skipping tests, and multi-locale tests."
applyTo: test/**/*.chpl
---
# Chapel UnitTest Guidelines (mason)

## File conventions
- Place tests in the `test` directory with a `.chpl` extension.
- Name files `test<Feature>.chpl` using CamelCase/PascalCase (e.g. `testRectangleArea.chpl`), where `<Feature>` describes what is tested.
- Name test procedures descriptively for what they verify (e.g. `testCalculateRectangleArea`).

## Basic structure
Every test proc takes a `borrowed Test` argument. Call `UnitTest.main()` once at the end of the file.

```chapel
use UnitTest;

proc test1(test: borrowed Test) throws {
  // test code goes here
  test.assertTrue(true); // example assertion, will always pass
}

UnitTest.main();
```

## Core rules
- **Focused**: each test verifies a single aspect of the functionality.
- **Independent**: one test's outcome must never affect another's; tests may run in any order.
- **Repeatable**: a test must succeed on a second run. Clean up resources (temp files/dirs) it creates. Use `defer` for cleanup that must run whether the test passes or fails.
- **Test bugs too**: if you find a bug (even a Chapel bug) while testing new code, still write the test with the *expected* output and tell the developer about the issue. Never leave buggy code untested, even if the test will fail.

## Assertions
Call these on the `test` argument:

| Method | Asserts |
|--------|---------|
| `test.assertTrue(cond)` | `cond` is true |
| `test.assertFalse(cond)` | `cond` is false |
| `test.assertEqual(actual, expected)` | values are equal |
| `test.assertNotEqual(actual, expected)` | values are not equal |
| `test.assertGreaterThan(actual, expected)` | `actual > expected` |
| `test.assertLessThan(actual, expected)` | `actual < expected` |
| `test.assertClose(actual, expected)` | `actual` is within tolerance of `expected` |
| `test.assertRegexMatch(actual, regex)` | `actual` matches `regex` exactly |

- `assertRegexMatch` requires a full match. To match a substring, wrap the pattern with `.*` on both ends, or use `test.assertTrue(regex.search(actual))`.

## Asserting thrown errors
`errorType` must be a subclass of `Error`; `args` must be a tuple.

```chapel
test.assertThrows(func, errorType, args = (), match = "");
```

Only some functions work with `assertThrows`. When it does not fit, use try/catch manually:

```chapel
try {
  functionThatThrows(arg1);
  test.assertTrue(false); // fail, did not throw
} catch e: ExpectedError {
  test.assertEqual(e.message, "Expected error message"); // pass, threw as expected
} catch {
  test.assertTrue(false); // fail, threw unexpected error
}
```

## Shared setup with dependsOn
Use `test.dependsOn(setupProc)` to guarantee a setup proc runs before the test.

```chapel
use FileSystem;
config const testTempDir = "/tmp/pathlib_test_temp_dir";

proc createTempDir(test: borrowed Test) throws {
  if FileSystem.exists(testTempDir) then FileSystem.rmTree(testTempDir);
  FileSystem.mkdir(testTempDir);
}

proc testTouch(test: borrowed Test) throws {
  test.dependsOn(createTempDir);
  // test code that requires the temp directory goes here
}
```

## Skipping tests
Runtime skip (config-driven):

```chapel
config const optionalTests = false;
proc myTest(test: borrowed Test) throws {
  test.skipIf(!optionalTests);
  // runs only when optionalTests is true
}
```

Compile-time skip (platform/config-driven):

```chapel
use ChplConfig;
proc myTest(test: borrowed Test) throws {
  if CHPL_COMM == "none" {
    test.skip("This test is not applicable when CHPL_COMM=none");
    return;
  }
  // compiled only when CHPL_COMM != "none"
}
```

## Multi-locale tests
Tests run with the wrong locale count are skipped.
- `test.addNumLocales(n)` — require exactly `n` locales.
- `test.minLocales(n)` / `test.maxLocales(n)` — require a range.

```chapel
proc myTest(test: borrowed Test) throws {
  test.minLocales(2);
  test.maxLocales(4);
  // requires between 2 and 4 locales
}
```

## Style note
These are guidelines, not hard rules. When adding tests to an existing file, match that file's established style. Follow these guidelines when creating a new test file.
