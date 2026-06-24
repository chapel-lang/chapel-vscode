# Documentation for Extension Developers

This document is intended for developers who want to contribute to the Chapel
extension for Visual Studio Code.

## Building locally

If you are building the extension locally, you will need to have Node.js and
npm installed. Then, you can install the dependencies by running `npm install
.` from the root of the repository.

To build and test the extension locally in debug mode, you can use the
Run/Debug tab to launch the extension in a new VSCode window (or press `F5`).

For some debugging purposes, it may be useful to build a local binary of the
extension using `vsce`. To do this, run
`mkdir -p bin && npx vsce package -o bin/chapel.vsix` from the root of the
repository.

## Installing locally

A local build of the extension can be installed in VSCode for testing purposes.
This can then be installed in VSCode by selecting "Install from VSIX" in the
Extensions view, or by running `code --install-extension bin/chapel.vsix` (if
you have the command line installed).

You can also download a prebuilt version of the extension from the CI. Opening
any CI run, in the "upload package" step, you can find a link to download the
`chapel.vsix` file. You can then install it the same way as above.


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
