# Documentation for Extension Developers

This document is intended for developers who want to contribute to the Chapel
extension for Visual Studio Code.

## Building locally

To build and test the extension locally in debug mode, you can use the
Run/Debug tab to launch the extension in a new VSCode window (or press `F5`).

For some debugging purposes, it may be useful to build a local binary of the
extension using `vsce`. To do this, run `npx vsce package -o bin/chapel.vsix`
from the root of the repository. This can then be installed in VSCode by
selecting "Install from VSIX" in the Extensions view, or by running `code
--install-extension bin/chapel.vsix`.

## Installing locally

It may be useful to install the extension locally for testing purposes. To do
this, you can use the `code` command line tool. First, build the extension as
described above, then run `code --install-extension bin/chapel.vsix` to install
it.

You can also download a prebuilt version of the extension from the CI. Opening
any CI run, in the "upload package" step, you can find a link to download the
`chapel.vsix` file. You can then install it using the same command as above.


## Publishing the extension

To publish the extension, create a new release on GitHub. Go to
https://github.com/chapel-lang/chapel-vscode/releases and click "Draft a new
release". Select the proper tag, which will be the new version number. This tag
should not exist yet and will be created in this process. The tag should
exactly match the version in `package.json`. Fill in any release notes (usually
just hitting the "Generate" button is sufficent), then publish the release.
This will trigger a GitHub Action that will build and publish the extension to
the Visual Studio Marketplace and OpenVSX Marketplace.

After the release has published successfully, you can verify that the extension
is available in the Visual Studio Marketplace by visiting
https://marketplace.visualstudio.com/items?itemName=chpl-hpe.chapel-vscode. You
can also verify that the extension is available in the OpenVSX Marketplace by
visiting https://open-vsx.org/extension/chpl-hpe/chapel-vscode.

Once the release publishes, another GitHub Action will be triggered to update
`package.json` to the next version number. This will open a new PR that will
need to be merged before any new work should be merged.
