// SYNTAX TEST "source.chapel" "none is a language constant (edc022f)"

var x: nothing = none;
//     ^^^^^^^ storage.type.chapel
//               ^^^^ constant.language.chapel
proc f(arg = none) { }
//           ^^^^ constant.language.chapel
if x == none then return;
//      ^^^^ constant.language.chapel
var y = (true, false, nil);
//       ^^^^ constant.language.chapel
//             ^^^^^ constant.language.chapel
//                    ^^^ constant.language.chapel
var noneSuch = 1;
//  ^^^^^^^^ - constant.language.chapel
