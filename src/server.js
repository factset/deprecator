'use strict';

const express = require(`express`);
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
  const app = express();

  app.get('/', (req, res) => res.send('Hello World!'));

  // Use the application's Express app directly.
  const server = app.listen(
    process.env.PORT,
    () => console.info(`[worker-${ID}] Starting server on port ${process.env.PORT}`),
  );

  /*
    * `close` event is received once the Express server has completed processing any requests it was handling at
    * the time `close()` was called on the server. At this point there are no requests being processed, so any
    * connections held by the service to external resources, such as databases, may be closed.
    */
  server.on(`close`, () => {
    console.log(`[worker-${ID}] All outstanding requests completed, now cleaning up resources before exiting service.`);

    // Close any connections that may be open to third-party resources, such as databases.
    // > redis.close();
  });

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  function gracefulShutdown() {
    console.log(`[worker-${ID}] Waiting for current requests to complete before continuing exit process.`);

    /*
      * Instruct the Express server to stop accepting new connections, but allow the Express server to remain alive
      * while it continues processing any requests it's already received. Once those requests have been completed
      * the `server` instance will receive the `close` event, at which point you may clean up any third-party resources
      * such as database connections.
      */
    server.close();
  }
}
