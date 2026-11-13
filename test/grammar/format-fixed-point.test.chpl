// SYNTAX TEST "source.chapel" "fixed-point %{#.#} placeholders (33f64d0)"

writef("%{###.##}\n", x);
//      ^^^^^^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
//               ^^ constant.character.escape.chapel - constant.other.placeholder.chapel
writef("%{#.}\n", x);
//      ^^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
writef("%{.#}\n", x);
//      ^^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
writef("%{##}\n", x);
//      ^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
writef("%{###.##}abc", x);
//               ^^^ string.quoted.double.chapel - constant.other.placeholder.chapel
// %{.} no longer matches the fixed-point rule, but the generic %{...} rule (28a8f69) still scopes it
writef("%{.}\n", x);
//      ^^^^ string.quoted.double.chapel constant.other.placeholder.chapel
