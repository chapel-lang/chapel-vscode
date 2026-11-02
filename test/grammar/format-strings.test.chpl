// SYNTAX TEST "source.chapel" "format string placeholders (28a8f69)"

writef("%i %10.3r %<10s %xi %? %%\n", a, b, c, d, e);
//      ^^ string.quoted.double.chapel constant.other.placeholder.chapel
//        ^ string.quoted.double.chapel - constant.other.placeholder.chapel
//         ^^^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
//                ^^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
//                      ^^^ string.quoted.double.chapel constant.other.placeholder.chapel
//                          ^^ string.quoted.double.chapel constant.other.placeholder.chapel
//                             ^^ string.quoted.double.chapel constant.other.placeholder.chapel
//                               ^^ string.quoted.double.chapel constant.character.escape.chapel
writef("%{xyz} %{a}b}\n", x, y);
//      ^^^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
//            ^ string.quoted.double.chapel - constant.other.placeholder.chapel
//             ^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
//                 ^^ string.quoted.double.chapel - constant.other.placeholder.chapel
writef('%i and %{##}\n', x, y);
//      ^^ string.quoted.single.chapel constant.other.placeholder.chapel
//         ^^^ string.quoted.single.chapel - constant.other.placeholder.chapel
//             ^^^^^ string.quoted.single.chapel constant.other.placeholder.chapel
var s = "100 percent";
//       ^^^^^^^^^^^ string.quoted.double.chapel - constant.other.placeholder.chapel
