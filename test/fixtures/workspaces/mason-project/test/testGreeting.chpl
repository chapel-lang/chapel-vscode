use UnitTest;
use MyPkg;

proc testGreeting(test: borrowed Test) throws {
  test.assertEqual(greeting(), "New mason package: MyPkg");
}

UnitTest.main();
