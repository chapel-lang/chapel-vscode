# Shared helpers for the wrapper tests. Must stay compatible with bash 3.2.

bats_require_minimum_version 1.5.0

REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
WRAPPERS_DIR="$REPO_ROOT/wrappers"

load "$REPO_ROOT/node_modules/bats-support/load"
load "$REPO_ROOT/node_modules/bats-assert/load"

# Wrappers run with only the fake tools and system dirs on PATH, so a real
# Chapel install never leaks into the tests.
SYSTEM_PATH="/usr/bin:/bin"

# Per-test fixtures: a fake CHPL_HOME and a fake PATH dir, each holding fake
# `chpl` and `mason` executables.
wrapper_setup() {
  unset CHPL_HOME FAKE_TOOL_STATUS FAKE_FIND_PYTHON_STATUS FAKE_BIN_SUBDIR_STATUS

  RECORD_DIR="$BATS_TEST_TMPDIR/record"
  mkdir -p "$RECORD_DIR"

  FAKE_CHPL_HOME="$BATS_TEST_TMPDIR/chpl-home"
  make_fake_chpl_home "$FAKE_CHPL_HOME"

  FAKE_PATH_DIR="$BATS_TEST_TMPDIR/path-bin"
  make_fake_tool "$FAKE_PATH_DIR/chpl" path-chpl
  make_fake_tool "$FAKE_PATH_DIR/mason" path-mason
  WRAPPER_PATH="$FAKE_PATH_DIR:$SYSTEM_PATH"
}

# make_fake_tool <path> <label>
# The fake records its argv (one arg per line), argc, PID and whether
# CHPL_HOME was set to $RECORD_DIR/<label>.*, then exits $FAKE_TOOL_STATUS.
make_fake_tool() {
  local path="$1" label="$2"
  mkdir -p "$(dirname "$path")"
  {
    echo '#!/bin/sh'
    printf "rec='%s'\n" "$RECORD_DIR/$label"
    cat <<'EOF'
echo $$ > "$rec.pid"
echo $# > "$rec.argc"
: > "$rec.args"
for arg in "$@"; do printf '%s\n' "$arg" >> "$rec.args"; done
if [ "${CHPL_HOME+set}" = set ]; then echo "set:$CHPL_HOME"; else echo unset; fi > "$rec.env"
exit "${FAKE_TOOL_STATUS:-0}"
EOF
  } > "$path"
  chmod +x "$path"
}

# make_fake_chpl_home <dir>
# find-python.sh prints /bin/sh, and chpl_bin_subdir.py is a shell script
# printing `test-platform`. Their exit statuses are controlled by
# $FAKE_FIND_PYTHON_STATUS and $FAKE_BIN_SUBDIR_STATUS.
make_fake_chpl_home() {
  local home="$1"
  mkdir -p "$home/util/config" "$home/util/chplenv"
  cat > "$home/util/config/find-python.sh" <<'EOF'
#!/bin/sh
if [ "${FAKE_FIND_PYTHON_STATUS:-0}" -ne 0 ]; then
  echo "find-python.sh: no python found" >&2
  exit "$FAKE_FIND_PYTHON_STATUS"
fi
echo /bin/sh
EOF
  chmod +x "$home/util/config/find-python.sh"
  cat > "$home/util/chplenv/chpl_bin_subdir.py" <<'EOF'
if [ "${FAKE_BIN_SUBDIR_STATUS:-0}" -ne 0 ]; then
  echo "chpl_bin_subdir.py: failed" >&2
  exit "$FAKE_BIN_SUBDIR_STATUS"
fi
echo test-platform
EOF
  make_fake_tool "$home/bin/test-platform/chpl" home-chpl
  make_fake_tool "$home/bin/test-platform/mason" home-mason
}

# run_wrapper <wrapper> [args...]
run_wrapper() {
  local name="$1"
  shift
  run --separate-stderr env PATH="$WRAPPER_PATH" "$WRAPPERS_DIR/$name" "$@"
}

assert_tool_ran() {
  [ -f "$RECORD_DIR/$1.pid" ] || fail "expected fake '$1' to have run"
}

refute_tool_ran() {
  [ ! -f "$RECORD_DIR/$1.pid" ] || fail "expected fake '$1' not to have run"
}

recorded() {
  cat "$RECORD_DIR/$1.$2"
}

# --- Checks shared by chpl.bats and mason.bats --------------------------------
# These use $TOOL (chpl or mason) and $MISSING_TOOL_MESSAGE.

check_uses_chpl_home() {
  export CHPL_HOME="$FAKE_CHPL_HOME"
  run_wrapper "$TOOL" --version
  assert_success
  assert_tool_ran "home-$TOOL"
  refute_tool_ran "path-$TOOL"
}

check_uses_path() {
  run_wrapper "$TOOL" --version
  assert_success
  assert_tool_ran "path-$TOOL"
  refute_tool_ran "home-$TOOL"
}

check_forwards_args() {
  local label
  local args=("hello world" "" "--flag=a b" "*" '$HOME' "  padded  " "tab	here" "-o")
  local expected
  expected="$(printf '%s\n' "${args[@]}")"

  for label in home path; do
    if [ "$label" = home ]; then
      export CHPL_HOME="$FAKE_CHPL_HOME"
    else
      unset CHPL_HOME
    fi
    run_wrapper "$TOOL" "${args[@]}"
    assert_success
    assert_equal "$(recorded "$label-$TOOL" argc)" "${#args[@]}"
    assert_equal "$(recorded "$label-$TOOL" args)" "$expected"
  done
}

check_propagates_exit_status() {
  export FAKE_TOOL_STATUS=42
  export CHPL_HOME="$FAKE_CHPL_HOME"
  run_wrapper "$TOOL"
  assert_equal "$status" 42
  assert_tool_ran "home-$TOOL"

  unset CHPL_HOME
  run_wrapper "$TOOL"
  assert_equal "$status" 42
  assert_tool_ran "path-$TOOL"
}

# With exec, the fake replaces the wrapper process, so it records the PID of
# the process the test started. Without exec it would be a child with a new PID.
check_execs_tool() {
  local label pid
  for label in home path; do
    if [ "$label" = home ]; then
      export CHPL_HOME="$FAKE_CHPL_HOME"
    else
      unset CHPL_HOME
    fi
    env PATH="$WRAPPER_PATH" "$WRAPPERS_DIR/$TOOL" > /dev/null 2>&1 &
    pid=$!
    wait "$pid"
    assert_tool_ran "$label-$TOOL"
    assert_equal "$(recorded "$label-$TOOL" pid)" "$pid"
  done
}

check_missing_on_path() {
  rm "$FAKE_PATH_DIR/$TOOL"
  run_wrapper "$TOOL" --version
  assert_failure
  assert_output ""
  assert_stderr "$MISSING_TOOL_MESSAGE"
}

check_missing_in_chpl_home() {
  rm "$FAKE_CHPL_HOME/bin/test-platform/$TOOL" "$FAKE_PATH_DIR/$TOOL"
  export CHPL_HOME="$FAKE_CHPL_HOME"
  run_wrapper "$TOOL" --version
  assert_failure
  assert_output ""
  assert_stderr "$MISSING_TOOL_MESSAGE"
}

check_bin_subdir_failure() {
  export CHPL_HOME="$FAKE_CHPL_HOME"
  export FAKE_BIN_SUBDIR_STATUS=3
  run_wrapper "$TOOL" --version
  assert_failure 1
  assert_output ""
  assert_stderr --partial "Could not determine subdirectory"
  refute_tool_ran "home-$TOOL"
  refute_tool_ran "path-$TOOL"
}

check_empty_chpl_home_unset() {
  export CHPL_HOME=""
  run_wrapper "$TOOL" --version
  assert_success
  assert_tool_ran "path-$TOOL"
  assert_equal "$(recorded "path-$TOOL" env)" "unset"
}

check_chpl_home_passed_through() {
  export CHPL_HOME="$FAKE_CHPL_HOME"
  run_wrapper "$TOOL" --version
  assert_success
  assert_equal "$(recorded "home-$TOOL" env)" "set:$FAKE_CHPL_HOME"
}

check_find_python_failure_falls_back_to_path() {
  export CHPL_HOME="$FAKE_CHPL_HOME"
  export FAKE_FIND_PYTHON_STATUS=1
  run_wrapper "$TOOL" --version
  assert_success
  assert_tool_ran "path-$TOOL"
}

check_chpl_home_with_spaces() {
  local home="$BATS_TEST_TMPDIR/chpl home"
  make_fake_chpl_home "$home"
  export CHPL_HOME="$home"
  run_wrapper "$TOOL" "a b"
  assert_success
  assert_tool_ran "home-$TOOL"
  refute_tool_ran "path-$TOOL"
  assert_equal "$(recorded "home-$TOOL" args)" "a b"
}
