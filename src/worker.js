'use strict';

// Process our repository queue.

const createInstallationToken = require(`./platforms/github`).createInstallationToken;
const getApplicationID = require(`./platforms/github`).getApplicationID;
const getApplicationKey = require(`./platforms/github`).getApplicationKey;
const createApplicationToken = require(`./platforms/github`).createApplicationToken;
const getEndpoint = require(`./platforms/github`).getEndpoint;
const getRateLimitRemaining = require(`./platforms/github`).getRateLimitRemaining;
const index = require(`./index`);
const redis = require(`redis`);
const RSMQWorker = require(`rsmq-worker`);
const throng = require(`throng`);

const applicationID = getApplicationID();
const applicationKey = getApplicationKey();
const applicationToken = createApplicationToken(applicationID, applicationKey);
const endpoint = getEndpoint();

/*
 * Extract number of concurrent processes we should start if we're running in an environment that
 * sets the `WEB_CONCURRENCY` environment variable. Otherwise, default to running with a concurrency of 1.
 */
const WORKERS = Number(process.env.WORKER_CONCURRENCY) || 1;

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

function start(workerID) {
  console.info(`[worker-${workerID}] starting`);

  const worker = new RSMQWorker(`deprecator`, {
    interval: [0.1, 1],
    maxReceiveCount: 1, // Only allow a message to be processed once.
    redis: redis.createClient(process.env.REDIS_URL),
    timeout: 300000, // Timeout for the worker to process a message.
  });

  worker.on(`message`, (message, next, taskID) => {
    const start = new Date();

    const [installationID, repository] = message.split(`,`);

    console.info(`[worker-${workerID}] processing task "${taskID}" for repository "${repository}"`);

    createInstallationToken(applicationToken, endpoint, installationID)
      .then(token => {
        return index({dryRun: true, endpoint, repository, rules: JSON.parse(process.env.RULES || {}), token})
          .then(deprecatedVersions => console.info(`[worker-${workerID}] deprecated the following versions - ${JSON.stringify(deprecatedVersions)}`))
          .catch(error => console.error(`[worker-${workerID}] ${error.stack}`))
          .then(() => console.info(`[worker-${workerID}] measure#worker.process-time=${new Date() - start}`))
          .then(() => console.info(`[worker-${workerID}] count#worker.repositories=1`))
          .then(() => getRateLimitRemaining(endpoint, token))
          .then(rateLimit => console.info(`[worker-${workerID}] sample#rate-limit.installation.${installationID}=${rateLimit}`))
          .catch(error => console.error(`[worker-${workerID}] ${error.stack}`));
      }).then(() => next());
  });

  process.on('SIGTERM', () => {
    // Does not seem to be called when testing locally.
    console.info(`[worker-${workerID}] quitting`);
    worker.quit();
    process.exit();
  });

  worker.start();
}
