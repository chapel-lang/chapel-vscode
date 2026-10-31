// SYNTAX TEST "source.chapel" "attributes (e7c1d77)"

@attribute(1)
// <---------- storage.type.attribute.chapel
//         ^ constant.numeric.chapel
@chplcheck.ignore("UnusedFormal")
// <----------------- storage.type.attribute.chapel
//                ^^^^^^^^^^^^^^ string.quoted.double.chapel
@unstable("this is unstable")
// <--------- storage.type.attribute.chapel
@deprecated(since="2.0", notes="use bar instead")
// <----------- storage.type.attribute.chapel
//          ^^^^^ - storage.type.attribute.chapel
//                ^^^^^ string.quoted.double.chapel
proc foo() { }
// <---- keyword.control.chapel - storage.type.attribute.chapel
  @llvm.assertVectorized()
//^^^^^^^^^^^^^^^^^^^^^^ storage.type.attribute.chapel
  @functionStatic var x = 1;
//^^^^^^^^^^^^^^^ storage.type.attribute.chapel
//                ^^^ storage.modifier.chapel
