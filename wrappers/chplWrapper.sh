#!/usr/bin/env bash

# if there is a CHPL_HOME, use that to find chpl
# if that fails, fall back to the chpl in path

chpl_compiler="none"

if [ -n "$CHPL_HOME" ]; then
  chpl_python=$($CHPL_HOME/util/config/find-python.sh 2> /dev/null)
  exit_code=$?
  if [ $exit_code -eq 0 ]; then
    chpl_bin_subdir=$($chpl_python $CHPL_HOME/util/chplenv/chpl_bin_subdir.py)
    chpl_compiler="$CHPL_HOME/bin/$chpl_bin_subdir/chpl"
  fi
else
  chpl_compiler="$(command -v chpl)"
fi

if [ ! -x "$chpl_compiler" ]; then
  echo "Could not find suitable chpl compiler in \$CHPL_HOME or \$PATH"
  exit 1
fi

if [ -z "$CHPL_HOME" ]; then
  unset CHPL_HOME
fi

$chpl_compiler "$@"
