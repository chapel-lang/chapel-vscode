---
name: chapel-mason-test
description: Run the tests of a Chapel mason project, including a single test file. Use whenever the user wants to run, re-run, or check Chapel tests in a workspace that contains a Mason.toml file. Do NOT use this to build the package or run its executable. Run `mason test` in a terminal, or as a VS Code task of type `mason`
---

# Test a Chapel mason project

Run the tests in a Chapel [mason](https://chapel-lang.org/docs/tools/mason/mason.html) package. A workspace is a mason project when it contains a `Mason.toml` file.

There are two equally valid ways to run tests, both from the folder that contains `Mason.toml`:

- **Terminal**: run `mason test ...` directly.
- **VS Code task** of type `mason` (with `command: "test"`): this routes through the extension. For a task, set `cwd` to the `Mason.toml` folder (`${workspaceFolder}` when it is at the workspace root).

## Run a single test file (most common)

To run one test file (e.g. after creating `test/testRectangleArea.chpl`), pass the file as the last argument after `--`.

Terminal:

```sh
mason test --show -- test/testRectangleArea.chpl
```

Or as a task:

```json
{
  "type": "mason",
  "command": "test",
  "args": ["--show", "--", "test/testRectangleArea.chpl"]
}
```

The file path is relative to the `Mason.toml` directory. `--show` streams the test output.

To run one named test within the file, add a filter before `--` (e.g. `mason test --show --filter=testCalculateRectangleArea -- test/testRectangleArea.chpl`):

```json
{
  "type": "mason",
  "command": "test",
  "args": ["--show", "--filter=testCalculateRectangleArea", "--", "test/testRectangleArea.chpl"]
}
```

## Run the whole test suite

Run `mason test` with no file argument — in a terminal, or as a task:

```json
{ "type": "mason", "command": "test" }
```

The extension also auto-provides a task with this definition, labeled `mason test`.

## `mason` task properties

| Property | Required | Description |
|----------|----------|-------------|
| `command` | Yes | Use `"test"` for this skill. |
| `args` | No | Extra arguments appended after `test`. For a single test file: `["--show", "--", "<file>"]`. |
| `cwd` | No | Folder containing `Mason.toml`. Defaults to the workspace root. |
| `env` | No | Environment variables to set for the run. |

To make a task reusable, add it to `.vscode/tasks.json` under `"tasks"` with a `"label"`, then run it by that label.

## Tips

- If tests fail to compile, build the package first (see the `chapel-mason-build` skill) to surface compile errors.
- Mason package test files live in the `test/` directory. See the Chapel UnitTest guidelines for how tests are structured.
