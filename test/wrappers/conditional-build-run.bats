#!/usr/bin/env bats

load helpers

OLD=202001010000
MID=202006010000
NEW=202101010000

setup() {
  unset FAKE_BUILD_STATUS
  LOG="$BATS_TEST_TMPDIR/log"
  : > "$LOG"
  WORK="$BATS_TEST_TMPDIR/work"
  mkdir -p "$WORK"

  # Stands in for `chpl <sources> -o <exe>`: logs "build" and writes a "new"
  # executable to the -o target, or fails with $FAKE_BUILD_STATUS.
  FAKE_BUILD="$BATS_TEST_TMPDIR/bin/fake-build"
  mkdir -p "$(dirname "$FAKE_BUILD")"
  {
    echo '#!/bin/sh'
    printf "log='%s'\n" "$LOG"
    printf "exe_template='%s'\n" "$BATS_TEST_TMPDIR/new-exe"
    cat <<'EOF'
echo build >> "$log"
if [ "${FAKE_BUILD_STATUS:-0}" -ne 0 ]; then
  echo "fake-build: error" >&2
  exit "$FAKE_BUILD_STATUS"
fi
while [ $# -gt 0 ]; do
  if [ "$1" = -o ]; then
    cp "$exe_template" "$2"
    exit 0
  fi
  shift
done
echo "fake-build: no -o" >&2
exit 2
EOF
  } > "$FAKE_BUILD"
  chmod +x "$FAKE_BUILD"
  make_exe "$BATS_TEST_TMPDIR/new-exe" new
}

# make_exe <path> <name>: an "executable" that logs "run <name> <args>".
make_exe() {
  {
    echo '#!/bin/sh'
    printf "echo \"run %s \$*\" >> '%s'\n" "$2" "$LOG"
  } > "$1"
  chmod +x "$1"
}

# run_cbr <sources> <exe>: invoke the wrapper the way the extension does.
run_cbr() {
  local sources="$1" exe="$2"
  local srcs
  srcs="$(echo "$sources" | tr ';' ' ')"
  run --separate-stderr env PATH="$SYSTEM_PATH" "$WRAPPERS_DIR/conditional-build-run" \
    "$sources" "$exe" "$FAKE_BUILD $srcs -o $exe" "$exe --numLocales=1"
}

assert_log() {
  assert_equal "$(cat "$LOG")" "$(printf '%s\n' "$@")"
}

@test "conditional-build-run: wrong number of arguments prints usage and exits 1" {
  local cbr="$WRAPPERS_DIR/conditional-build-run"
  local n
  for n in 0 1 3 5; do
    case $n in
      0) run --separate-stderr "$cbr" ;;
      1) run --separate-stderr "$cbr" a ;;
      3) run --separate-stderr "$cbr" a b c ;;
      5) run --separate-stderr "$cbr" a b c d e ;;
    esac
    assert_failure 1
    assert_output ""
    assert_stderr --partial "Usage: conditional-build-run"
  done
  assert_log
}

@test "conditional-build-run: missing executable builds, then runs" {
  touch "$WORK/main.chpl"
  run_cbr "$WORK/main.chpl" "$WORK/main"
  assert_success
  assert_log "build" "run new --numLocales=1"
}

@test "conditional-build-run: sources older than the executable run without building" {
  touch -t "$OLD" "$WORK/main.chpl"
  make_exe "$WORK/main" old
  touch -t "$NEW" "$WORK/main"
  run_cbr "$WORK/main.chpl" "$WORK/main"
  assert_success
  assert_log "run old --numLocales=1"
}

@test "conditional-build-run: a source newer than the executable builds, then runs" {
  touch -t "$NEW" "$WORK/main.chpl"
  make_exe "$WORK/main" old
  touch -t "$OLD" "$WORK/main"
  run_cbr "$WORK/main.chpl" "$WORK/main"
  assert_success
  assert_log "build" "run new --numLocales=1"
}

@test "conditional-build-run: multiple ;-separated sources all older run without building" {
  touch -t "$OLD" "$WORK/a.chpl" "$WORK/b.chpl" "$WORK/c.chpl"
  make_exe "$WORK/main" old
  touch -t "$MID" "$WORK/main"
  run_cbr "$WORK/a.chpl;$WORK/b.chpl;$WORK/c.chpl" "$WORK/main"
  assert_success
  assert_log "run old --numLocales=1"
}

@test "conditional-build-run: multiple ;-separated sources build if any is newer" {
  touch -t "$OLD" "$WORK/a.chpl" "$WORK/c.chpl"
  touch -t "$NEW" "$WORK/b.chpl"
  make_exe "$WORK/main" old
  touch -t "$MID" "$WORK/main"
  run_cbr "$WORK/a.chpl;$WORK/b.chpl;$WORK/c.chpl" "$WORK/main"
  assert_success
  assert_log "build" "run new --numLocales=1"
}

@test "conditional-build-run: a missing source file builds" {
  touch -t "$OLD" "$WORK/a.chpl"
  make_exe "$WORK/main" old
  touch -t "$NEW" "$WORK/main"
  run_cbr "$WORK/a.chpl;$WORK/missing.chpl" "$WORK/main"
  assert_success
  assert_log "build" "run new --numLocales=1"
}

@test "conditional-build-run: failed build exits non-zero and does not run the old executable" {
  skip "runs the old binary when compilation fails (#130)"
  touch -t "$NEW" "$WORK/main.chpl"
  make_exe "$WORK/main" old
  touch -t "$OLD" "$WORK/main"
  export FAKE_BUILD_STATUS=1
  run_cbr "$WORK/main.chpl" "$WORK/main"
  assert_failure
  assert_log "build"
}

@test "conditional-build-run: up-to-date sources with spaces in their paths are not rebuilt" {
  skip "breaks on paths with spaces (#143)"
  mkdir -p "$WORK/my dir"
  touch -t "$OLD" "$WORK/my dir/a.chpl" "$WORK/my dir/b.chpl"
  make_exe "$WORK/main" old
  touch -t "$NEW" "$WORK/main"
  run --separate-stderr env PATH="$SYSTEM_PATH" "$WRAPPERS_DIR/conditional-build-run" \
    "$WORK/my dir/a.chpl;$WORK/my dir/b.chpl" "$WORK/main" \
    "$FAKE_BUILD '$WORK/my dir/a.chpl' '$WORK/my dir/b.chpl' -o '$WORK/main'" \
    "$WORK/main --numLocales=1"
  assert_success
  assert_log "run old --numLocales=1"
}

@test "conditional-build-run: source and executable paths with spaces build and run" {
  skip "breaks on paths with spaces (#143)"
  mkdir -p "$WORK/my dir"
  touch -t "$NEW" "$WORK/my dir/main.chpl"
  make_exe "$WORK/my dir/main" old
  touch -t "$OLD" "$WORK/my dir/main"
  run --separate-stderr env PATH="$SYSTEM_PATH" "$WRAPPERS_DIR/conditional-build-run" \
    "$WORK/my dir/main.chpl" "$WORK/my dir/main" \
    "$FAKE_BUILD '$WORK/my dir/main.chpl' -o '$WORK/my dir/main'" \
    "'$WORK/my dir/main' --numLocales=1"
  assert_success
  assert_log "build" "run new --numLocales=1"
}
