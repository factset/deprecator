'use strict';

/* Process our queue. */

const throng = require(`throng`);

/*
 * Extract number of concurrent processes we should start if we're running in an environment that
 * sets the `WEB_CONCURRENCY` environment variable. Otherwise, default
 * to running with a concurrency of 1.
 */
const WORKERS = Number(process.env.WEB_CONCURRENCY) || 1;

/*
 * Enable support for starting multiple instances of our service to leverage all available CPU cores
 * on the current system.
 */
throng({
  start,
  lifetime: Infinity,
  master: () => { },
  workers: WORKERS,
});

function start(ID) {
  console.log(`${ID}`);
}
