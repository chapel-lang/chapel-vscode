// SYNTAX TEST "source.chapel" "smoke test for common Chapel constructs"

/* A doc comment
// <-- comment.block.chapel punctuation.definition.comment.chapel
//^^^^^^^^^^^^^^ comment.block.chapel
   describing the module */
// ^^^^^^^^^^^^^^^^^^^^^^ comment.block.chapel
//                       ^^ comment.block.chapel punctuation.definition.comment.chapel
module M {
// <------ keyword.control.chapel

// a line comment
// <-- comment.line.double-slash.chapel punctuation.definition.comment.chapel

  /* Doc comment for foo */
//^^ comment.block.chapel punctuation.definition.comment.chapel
//   ^^^^^^^^^^^^^^^^^^^ comment.block.chapel
  proc foo(x: int, ref y: real): bool {
//^^^^ keyword.control.chapel
//         ^ - keyword
//          ^ keyword.operator.others.chapel
//            ^^^ storage.type.chapel
//                 ^^^ storage.modifier.chapel
//                        ^^^^ storage.type.chapel
//                               ^^^^ storage.type.chapel
    return x > 0;
//  ^^^^^^ keyword.control.chapel
//           ^ keyword.operator.comparison.chapel
//             ^ constant.numeric.chapel
  }

  var a = 42;
//^^^ storage.modifier.chapel
//      ^ keyword.operator.assignment.chapel
//        ^^ constant.numeric.chapel
  const b = 3.14;
//^^^^^ storage.modifier.chapel
//          ^^^^ constant.numeric.chapel
  param c = 0x1F + 0b101 + 0o17 + 1_000;
//^^^^^ storage.modifier.chapel
//          ^^^^ constant.numeric.chapel
//               ^ keyword.operator.arithmetic.chapel
//                 ^^^^^ constant.numeric.chapel
//                         ^^^^ constant.numeric.chapel
//                                ^^^^^ constant.numeric.chapel
  config const n = 1e6;
//^^^^^^ storage.modifier.chapel
//       ^^^^^ storage.modifier.chapel
//                 ^^^ constant.numeric.chapel

  var s = "hello\n";
//        ^ string.quoted.double.chapel punctuation.definition.string.begin.chapel
//         ^^^^^ string.quoted.double.chapel
//              ^^ string.quoted.double.chapel constant.character.escape.chapel
//                ^ string.quoted.double.chapel punctuation.definition.string.end.chapel
  var t = 'world';
//        ^^^^^^^ string.quoted.single.chapel

  record R { var x: int; }
//^^^^^^ keyword.control.chapel
//           ^^^ storage.modifier.chapel
  class C { }
//^^^^^ keyword.control.chapel

  forall i in 1..n do foo(i, a);
//^^^^^^ keyword.control.chapel
//         ^^ keyword.control.chapel
//             ^^ keyword.operator.arithmetic.chapel
//                 ^^ keyword.control.chapel
  coforall loc in Locales do on loc { }
//^^^^^^^^ keyword.control.chapel
//                ^^^^^^^ support.variable.chapel
//                           ^^ keyword.control.chapel
  if this != nil then writeln(true);
//^^ keyword.control.chapel
//   ^^^^ variable.language.chapel
//        ^^ keyword.operator.comparison.chapel
//           ^^^ constant.language.chapel
//               ^^^^ keyword.control.chapel
//                            ^^^^ constant.language.chapel
}
