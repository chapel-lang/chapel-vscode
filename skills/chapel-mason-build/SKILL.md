---
name: chapel-mason-build
description: Compile (build) a Chapel mason project. Use only when the user wants to build or compile the package, or to surface compile errors. Do NOT use this to run the executable or to run tests. Run `mason build` in a terminal, or as a VS Code task of type `mason`.
---

# Build a Chapel mason project

Compile a Chapel [mason](https://chapel-lang.org/docs/tools/mason/mason.html) package. A workspace is a mason project when it contains a `Mason.toml` file.

There are two equally valid ways to build, both from the folder that contains `Mason.toml`:

- **Terminal**: run `mason build`.
- **VS Code task** of type `mason` (with `command: "build"`): this routes through the extension. For a task, set `cwd` to the `Mason.toml` folder (`${workspaceFolder}` when it is at the workspace root).

## Build the package

Run `mason build` — in a terminal, or as a task:

```json
{ "type": "mason", "command": "build" }
```

The extension also auto-provides a task with this definition, labeled `mason build`.

## `mason` task properties

| Property | Required | Description |
|----------|----------|-------------|
| `command` | Yes | Use `"build"` for this skill. |
| `args` | No | Extra arguments appended after `build`. |
| `cwd` | No | Folder containing `Mason.toml`. Defaults to the workspace root. |
| `env` | No | Environment variables to set for the run. |

To make a task reusable, add it to `.vscode/tasks.json` under `"tasks"` with a `"label"`, then run it by that label.

## Tips

- Build to surface compile errors before running or testing.
- To run the built executable, use the `chapel-mason-run` skill. To run tests, use the `chapel-mason-test` skill.
