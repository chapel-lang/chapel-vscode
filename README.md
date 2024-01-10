# chapel-vscode extension

After the extension is installed, you may need to configure it. Add the following to your `settings.json` in VSCode.

```json
  "chapel.CHPL_HOME": "/path/to/your/chapel/home"
```

Make sure that whatever the path to `CHPL_HOME`, that it has a built frontend library and that you have run `make chapel-py-venv` to install the python bindings.
