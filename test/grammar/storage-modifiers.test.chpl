// SYNTAX TEST "source.chapel" "shared/owned/borrowed/unmanaged are storage modifiers, not control keywords (892be22)"

var a: shared C?;
//     ^^^^^^ storage.modifier.chapel - keyword.control.chapel
var b: owned C;
//     ^^^^^ storage.modifier.chapel - keyword.control.chapel
var c: borrowed C;
//     ^^^^^^^^ storage.modifier.chapel - keyword.control.chapel
var d: unmanaged C;
//     ^^^^^^^^^ storage.modifier.chapel - keyword.control.chapel
var e = new shared C();
//      ^^^ keyword.control.chapel
//          ^^^^^^ storage.modifier.chapel - keyword.control.chapel
proc f(x: owned C, y: shared C) { }
//        ^^^^^ storage.modifier.chapel
//                    ^^^^^^ storage.modifier.chapel
var sharedCount = 0;
//  ^^^^^^^^^^^ - storage.modifier.chapel
var g: single int;
//     ^^^^^^ - storage.modifier.chapel
