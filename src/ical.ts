const fs = require('fs');
const ical = require('./icalendar');

fs.readFile('source.ics', (err, buf) => {
  if (err) {
    console.log('Error: ' + err);
    return;
  }

  console.log(ical.Component.fromBuffer(buf).toString());
});
