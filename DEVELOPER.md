# Documentation for Extension Developers

This document is intended for developers who want to contribute to the Chapel extension for Visual Studio Code.

## Building locally

To build and test the extension locally in debug mode, you can use the Run/Debug tab to launch the extension in a new VSCode window (or press `F5`).

For some debugging purposes, it may be useful to build a local binary of the extension using `vsce`. To do this, run `npx vsce package -o bin/chapel.vsix` from the root of the repository. This can then be installed in VSCode by selecting "Install from VSIX" in the Extensions view, or by running `code --install-extension bin/chapel.vsix`.
