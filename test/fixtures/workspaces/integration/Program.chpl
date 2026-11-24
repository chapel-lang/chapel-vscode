use IO;

// The build-and-run tests look for this file to tell whether the program ran.
var marker = openWriter("Program.marker");
marker.writeln("Program ran");
marker.close();
