/* Documentation for MyPkg */
module MyPkg {
  proc greeting(): string {
    return "New mason package: MyPkg";
  }

  proc main() {
    writeln(greeting());
  }
}
