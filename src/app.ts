import axios from 'axios';
import express = require('express');
import icalendar = require('./icalendar');
import yargs = require('yargs/yargs');

const app = express();

const argv = yargs(process.argv.slice(2))
    .options({
      'feed': {
        describe: 'The feed URL to proxy',
        demandOption: true,
        type: 'string',
      },
      'ip': {
        default: '127.0.0.1',
        describe: 'IP address to listen on',
        type: 'string',
      },
      'port': {
        default: 43641,
        describe: 'Port to listen on',
        type: 'number',
      },
      'minutes': {
        default: 10,
        describe: 'Minutes before the event to post a reminder',
        type: 'number',
      },
    })
    .argv;

app.route('/')
    .all((req, res, next) => {
      console.log(req.method + ' /');
      if (req.method == 'PROPFIND') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.end('Um, hi!\r\n');
        // PROPFIND HERE
      } else {
        next();
      }
    })
    .get((req, res) => {
      axios.get(argv.feed)
          .then((sourceResult) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            const processedData = addReminders(sourceResult.data);
            res.end(processedData);
            console.log(res.getHeaders());
            console.log('Success (length ' + processedData.length + ')');
          })
          .catch((error) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Error: ' + error.message);
            console.log('Error (' + error.message + ')');
          });
    })
    .put((req, res) => {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', () => {
        console.log('Body: ' + body);
        res.statusCode = 200;
        // res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        // const processedData = addReminders(sourceResult.data);
        // res.end(processedData);
        // console.log(res.getHeaders());
        // console.log('Success (length ' + processedData.length + ')');
      });
    });

app.listen(argv.port, argv.ip, () => {
  console.log('Listening on ' + argv.ip + ':' + argv.port + '...');
});


/**
 * @param {string} input
 * @return {string}
 */
function addReminders(input) {
  const parsedInput = icalendar.Component.fromString(input);
  const reminder = new icalendar.Component(
      'VALARM',
      [
        new icalendar.Property('ACTION', {}, 'DISPLAY'),
        new icalendar.Property('TRIGGER', {VALUE: 'DURATION'}, '-PT10M'),
        new icalendar.Property('DESCRIPTION', {}, 'Checkins'),
      ],
      [],
  );

  for (const event of parsedInput.components) {
    if (event.name == 'VEVENT') {
      event.components.push(reminder);
    }
  }

  return parsedInput.toString();
}
