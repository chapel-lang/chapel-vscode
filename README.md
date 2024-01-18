# chapel-vscode extension

## Features

- Intellisense
  - GotoDefinition: jump to a symbols definition
  - Hover: hover over a symbol to view its signature and documentation
  - Code Completion: suggest completion for symbols in the current file
  - Symbol List: see all symbols for a file
  - Errors/Warning: see Chapel errors and warnings
- Linting
  - see Chapel linter warnings on potential errors and style suggestions
- Snippets
- Syntax Highlighting

## Setup

After installing the extension, follow these steps to make sure VSCode is setup to use the extension.

### From an existing Chapel build

These directions assume you already have Chapel built from source and know what your `CHPL_HOME` is:

1. Execute the following command to build the python tools `(cd $CHPL_HOME && make chapel-py-venv)`
2. Set your `CHPL_HOME` in your VSCode settings.json as `"chapel.CHPL_HOME": "/path/to/your/chapel/home"`.

### Without an existing Chapel build

1. Obtain a copy of latest Chapel source release from <https://chapel-lang.org/download.html>
2. After downloading the tar, extract the source tree with `tar xzf chapel-VERSION.tar.gz`
3. Build the python tools with ``(cd chapel-VERSION && CHPL_HOME=`pwd` make chapel-py-venv && echo "Your CHPL_HOME is '`pwd`'")``
4. The above command will tell you what your `CHPL_HOME` is, add it to your VSCode settings.json as `"chapel.CHPL_HOME": "/path/to/your/chapel/home"`.

## Linter options

Individual linter rules in the Chapel linter, `chplcheck`, can be turned on or off. This is done by adding arguments to your VSCode settings. For example, the following turns on the NestedCoforalls and UnusedFormal rules.

```json
"chapel.chplcheck.args": [
  "--enable-rule", "NestedCoforalls", "--enable-rule", "UnusedFormal"
],
```
