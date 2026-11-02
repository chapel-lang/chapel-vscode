// A stand-in for chpl, mason and programs built by the fake chpl, driven by FAKE_* env vars.
const fs = require("fs");
const path = require("path");

const tool = process.argv[2];
const args = process.argv.slice(3);

function record(extra = {}) {
  const dir = process.env.FAKE_TOOL_RECORD_DIR;
  if (!dir) {
    return;
  }
  const env = {
    CHPL_HOME: process.env.CHPL_HOME,
    CHPL_DEVELOPER: process.env.CHPL_DEVELOPER,
    PATH: process.env.PATH,
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("FAKE_") || key.startsWith("TEST_")) {
      env[key] = value;
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ tool, argv: args, cwd: process.cwd(), env, ...extra });
  fs.appendFileSync(path.join(dir, `${tool}.jsonl`), `${line}\n`);
}

function chpl() {
  record();
  const outIndex = args.indexOf("-o");
  const output = outIndex >= 0 ? args[outIndex + 1] : "a.out";
  const sources = args.filter((arg) => arg.endsWith(".chpl"));
  for (const source of sources) {
    if (!fs.existsSync(source)) {
      process.stderr.write(`error: cannot find '${source}'\n`);
      process.exit(1);
    }
    if (fs.readFileSync(source, "utf8").includes("COMPILE_ERROR")) {
      process.stderr.write(`${source}:1: error: fake compile error\n`);
      process.exit(1);
    }
  }
  const program = path.join(__dirname, "fake-program");
  const build = JSON.stringify(JSON.stringify({ sources, time: Date.now() }));
  fs.writeFileSync(output, `#!/usr/bin/env bash\nFAKE_PROGRAM_EXE="$0" FAKE_PROGRAM_BUILD=${build} exec "${program}" "$@"\n`);
  fs.chmodSync(output, 0o755);
}

switch (tool) {
  case "chpl":
    chpl();
    break;
  case "mason":
    record();
    process.exit(Number(process.env.FAKE_MASON_EXIT || "0"));
    break;
  case "run":
    record({ exe: process.env.FAKE_PROGRAM_EXE, build: process.env.FAKE_PROGRAM_BUILD });
    break;
  default:
    process.stderr.write(`unknown fake tool ${tool}\n`);
    process.exit(2);
}
