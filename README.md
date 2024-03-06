# chapel-vscode extension

## Core Features

- Intellisense
  - Go to Definition: jump to or peek a symbol's definition
  - Hover: hover over a symbol to view its signature and documentation
  - References: view all mentions of a symbol across a workspace
  - Code Completion: suggest completion for symbols in the current file
  - Symbol List: see all symbols in a file
  - Errors/Warning: see Chapel errors and warnings
- Linting
  - see Chapel linter warnings on potential errors and style suggestions
- Snippets
- Syntax Highlighting

### Experimental Features

- Intellisense
  - Inlays: view values, types, and named call arguments inline with code
  - Generic Instantiations: inspect generic code with helpful annotations
  - Dead Code: highlight dead code that will never execute

> **_:warning: CAUTION:_**
> These features use a work-in-progress resolver for Chapel called Dyno to further
> inspect your code. To enable these features, use Dyno by setting
> `chapel.chpl-language-server.resolver` to `true`. Enabling the Dyno resolver
> for most Chapel projects will likely result in a crash.

## Setup

After installing the extension, follow these steps to make sure VSCode is set up to use the extension.

### From an existing Chapel build

The extension can auto-detect your `CHPL_HOME`, just open a Chapel file. The extension will prompt you to select an existing Chapel install to configure your editor. If you don't see your value of `CHPL_HOME` or don't know the right one, run `chpl --print-chpl-home` to get the right value. If the automatic installation fails, you can explicitly set your `CHPL_HOME` in your VSCode settings.json as `"chapel.CHPL_HOME": "/path/to/your/chapel/home"`.

The extension can also auto-build the Chapel language tools and will prompt you to do so if they are missing. If you prefer to build them manually, run the following: `(export CHPL_HOME=/path/to/your/chapel/home && cd $CHPL_HOME && make chpl-language-server && make chplcheck)`

### Without an existing Chapel build

1. Obtain a copy of latest Chapel source release from <https://chapel-lang.org/download.html>
2. After downloading the tar, extract the source tree with `tar xzf chapel-VERSION.tar.gz`
3. After unpacking the tar, you can treat this as your `CHPL_HOME` (`"/path/to/unpacked/source/chapel-VERSION"`) and follow the steps for an existing Chapel build.

## Linter options

Individual linter rules in the Chapel linter, `chplcheck`, can be turned on or off. This is done by adding arguments to your VSCode settings. For example, the following turns on the NestedCoforalls and UnusedFormal rules.

```json
"chapel.chplcheck.args": [
  "--enable-rule", "NestedCoforalls", "--enable-rule", "UnusedFormal"
],
```
