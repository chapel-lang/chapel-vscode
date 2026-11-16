#!/usr/bin/env bats

load helpers

TOOL=chpl
MISSING_TOOL_MESSAGE='Could not find suitable chpl compiler in $CHPL_HOME or $PATH'

setup() {
  wrapper_setup
}

@test "chpl: uses \$CHPL_HOME/bin/<platform>/chpl when CHPL_HOME is set" {
  check_uses_chpl_home
}

@test "chpl: uses chpl from PATH when CHPL_HOME is not set" {
  check_uses_path
}

@test "chpl: forwards arguments exactly, including ones with spaces" {
  check_forwards_args
}

@test "chpl: propagates the exit status of chpl" {
  check_propagates_exit_status
}

@test "chpl: execs chpl so no wrapper process remains" {
  check_execs_tool
}

@test "chpl: missing chpl on PATH fails with an error on stderr only" {
  check_missing_on_path
}

@test "chpl: missing chpl in CHPL_HOME fails with an error on stderr only" {
  check_missing_in_chpl_home
}

@test "chpl: chpl_bin_subdir.py failure reports 'Could not determine subdirectory'" {
  check_bin_subdir_failure
}

@test "chpl: an empty CHPL_HOME is unset for chpl" {
  check_empty_chpl_home_unset
}

@test "chpl: CHPL_HOME is passed through to chpl" {
  check_chpl_home_passed_through
}

@test "chpl: falls back to PATH when CHPL_HOME is set but find-python.sh fails" {
  skip "wrapper does not fall back to PATH when find-python.sh fails (#144)"
  check_find_python_failure_falls_back_to_path
}

@test "chpl: CHPL_HOME containing spaces works" {
  skip "\$CHPL_HOME is unquoted in the wrapper (#144)"
  check_chpl_home_with_spaces
}
