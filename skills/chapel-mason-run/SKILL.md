---
name: chapel-mason-run
description: Build and run the executable of a Chapel mason project. Use only when the user wants to run or execute the package's program. Do NOT use this to run tests (use chapel-mason-test) or to only compile (use chapel-mason-build). Run `mason run` in a terminal, or as a VS Code task of type `mason`.
---

# Run a Chapel mason project

Build and run the executable of a Chapel [mason](https://chapel-lang.org/docs/tools/mason/mason.html) package. A workspace is a mason project when it contains a `Mason.toml` file.

There are two equally valid ways to run, both from the folder that contains `Mason.toml`:

- **Terminal**: run `mason run --build`.
- **VS Code task** of type `mason` (with `command: "run"`): this routes through the extension. For a task, set `cwd` to the `Mason.toml` folder (`${workspaceFolder}` when it is at the workspace root).

## Build and run the executable

Run `mason run --build` (the `--build` flag compiles sources before running) — in a terminal, or as a task:

```json
{ "type": "mason", "command": "run", "args": ["--build"] }
```

The extension also auto-provides a task with this definition, labeled `mason run`.

To pass arguments to the program, append them after `--build` (e.g. `mason run --build -- arg1 arg2`):

```json
{ "type": "mason", "command": "run", "args": ["--build", "--", "arg1", "arg2"] }
```

## `mason` task properties

| Property | Required | Description |
|----------|----------|-------------|
| `command` | Yes | Use `"run"` for this skill. |
| `args` | No | Extra arguments appended after `run`. Include `"--build"` to compile first. |
| `cwd` | No | Folder containing `Mason.toml`. Defaults to the workspace root. |
| `env` | No | Environment variables to set for the run. |

To make a task reusable, add it to `.vscode/tasks.json` under `"tasks"` with a `"label"`, then run it by that label.

## Tips

- To only compile without running, use the `chapel-mason-build` skill. To run tests, use the `chapel-mason-test` skill.
