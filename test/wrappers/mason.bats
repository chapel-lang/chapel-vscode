#!/usr/bin/env bats

load helpers

TOOL=mason
MISSING_TOOL_MESSAGE="Could not find suitable install of 'mason' in \$CHPL_HOME or \$PATH"

setup() {
  wrapper_setup
}

@test "mason: uses \$CHPL_HOME/bin/<platform>/mason when CHPL_HOME is set" {
  check_uses_chpl_home
}

@test "mason: uses mason from PATH when CHPL_HOME is not set" {
  check_uses_path
}

@test "mason: forwards arguments exactly, including ones with spaces" {
  check_forwards_args
}

@test "mason: propagates the exit status of mason" {
  check_propagates_exit_status
}

@test "mason: execs mason so no wrapper process remains" {
  check_execs_tool
}

@test "mason: missing mason on PATH fails with an error on stderr only" {
  check_missing_on_path
}

@test "mason: missing mason in CHPL_HOME fails with an error on stderr only" {
  check_missing_in_chpl_home
}

@test "mason: chpl_bin_subdir.py failure reports 'Could not determine subdirectory'" {
  check_bin_subdir_failure
}

@test "mason: an empty CHPL_HOME is unset for mason" {
  check_empty_chpl_home_unset
}

@test "mason: CHPL_HOME is passed through to mason" {
  check_chpl_home_passed_through
}

@test "mason: falls back to PATH when CHPL_HOME is set but find-python.sh fails" {
  skip "wrapper does not fall back to PATH when find-python.sh fails (#144)"
  check_find_python_failure_falls_back_to_path
}

@test "mason: CHPL_HOME containing spaces works" {
  skip "\$CHPL_HOME is unquoted in the wrapper (#144)"
  check_chpl_home_with_spaces
}
