// SYNTAX TEST "source.chapel" "sync statement should be highlighted as a keyword"
// Pending https://github.com/chapel-lang/chapel-vscode/issues/23; not run by `npm run test:grammar`.

sync {
// <---- keyword.control.chapel
  begin f();
//^^^^^ keyword.control.chapel
}
sync begin f();
// <---- keyword.control.chapel
//   ^^^^^ keyword.control.chapel
var x: sync int;
//     ^^^^ storage.modifier.chapel
