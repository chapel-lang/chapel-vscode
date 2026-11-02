module Lint {
  var count = 1;

  proc unusedFormal(x: int) {
    for i in 1..3 {
      writeln("hi");
    }
  }

  class lowerClass { }

  proc main() {
    if (count > 0) {
      unusedFormal(1);
    }
  }
}
