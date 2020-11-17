# iCalendar Reminder Proxy

This is a proxy to inject reminders into iCalendar feeds. It is designed to run
locally and sit between your favourite calendar app and the remote feed URL.
When your calendar app checks for updates, the request is received by the proxy,
which sends the request on to the remote server. It modifies the response by
inserting reminder events
([VALARM](https://tools.ietf.org/html/rfc5545#section-3.6.6)) before sending the
result on to the calendar app.

## Getting started

You must have Node and NPM installed.

To get started, clone this repository, then run:

    npm install

To start the server, run:

    node app.js https://example.com/feed.ics

You can then add the following feed URL to your calendar app:

    http://127.0.0.1:43641

## To do

* Figure out why Thunderbird is giving me reminders every half-hour.
* This uses a very naive parser. It should be fixed to actually understand the
  iCalendar syntax rather than doing a simple string replacement.
