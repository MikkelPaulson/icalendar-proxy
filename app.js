const axios = require('axios');
const express = require('express');
const yargs = require('yargs/yargs');

const app = express();

const argv = yargs(process.argv.slice(2))
    .command('* <feed>', 'Start the proxy server', (yargs) => {
      yargs.positional('feed', {
        describe: 'The feed URL to proxy',
        type: 'string',
      });
    })
    .options({
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
  return input.replace(
      /^SUMMARY:(.*)$/gm,
      'SUMMARY:$1\r\n' +
      'BEGIN:VALARM\r\n' +
      'ACTION:DISPLAY\r\n' +
      'TRIGGER;VALUE=DURATION:-PT' + argv.minutes + 'M\r\n' +
      'DESCRIPTION:$1\r\n' +
      'END:VALARM',
  );
}
