// SYNTAX TEST "source.chapel" "triple-quoted multi-line strings (bb96153, 35ba3c5)"

const a = """first line
//        ^^^ string.quoted.double.multi.chapel punctuation.definition.string.begin.chapel
//           ^^^^^^^^^^ string.quoted.double.multi.chapel
second "quoted" 'line' %i
// <------ string.quoted.double.multi.chapel
//     ^^^^^^^^ string.quoted.double.multi.chapel - punctuation.definition.string.end.chapel
//              ^^^^^^ string.quoted.double.multi.chapel
//                     ^^ string.quoted.double.multi.chapel constant.other.placeholder.chapel
var notCode = 1;
// <--- string.quoted.double.multi.chapel - storage.modifier.chapel
end""";
// <--- string.quoted.double.multi.chapel
// ^^^ string.quoted.double.multi.chapel punctuation.definition.string.end.chapel
//    ^ - string

const b = '''first line
//        ^^^ string.quoted.single.multi.chapel punctuation.definition.string.begin.chapel
//           ^^^^^^^^^^ string.quoted.single.multi.chapel
it's "still" a string
// <-------------------- string.quoted.single.multi.chapel
end''';
// <--- string.quoted.single.multi.chapel
// ^^^ string.quoted.single.multi.chapel punctuation.definition.string.end.chapel
//    ^ - string

const c = "single line";
//        ^^^^^^^^^^^^^ string.quoted.double.chapel - string.quoted.double.multi.chapel
const d = 'single line';
//        ^^^^^^^^^^^^^ string.quoted.single.chapel - string.quoted.single.multi.chapel
