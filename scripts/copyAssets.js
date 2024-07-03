const { cpSync } = require("fs");

cpSync(
  "node_modules/@markwhen/timeline/dist/index.html",
  "assets/views/timeline.html"
);
cpSync(
  "node_modules/@markwhen/calendar/dist/index.html",
  "assets/views/calendar.html"
);
