'use strict';

// Queue up all repositories for processing.

const bluebird = require(`bluebird`);
const debug = require(`debug`)(`deprecator`);
const {
  fetchInstallations,
  fetchInstallationRepositories,
  getApplicationID,
  getApplicationKey,
  createApplicationToken,
  getEndpoint,
} = require(`./platforms/github`);
const redis = require(`redis`);
const RSMQWorker = require(`rsmq-worker`);

const applicationID = getApplicationID();
const applicationKey = getApplicationKey();
const applicationToken = createApplicationToken(applicationID, applicationKey);
const endpoint = getEndpoint();
const worker = bluebird.promisifyAll(new RSMQWorker(`deprecator`, {autostart: true, redis: redis.createClient(process.env.REDIS_URL)}));

fetchInstallations(applicationToken, endpoint)
  .then(installations => Promise.all(installations
    .map(installation => fetchInstallationRepositories(applicationToken, endpoint, installation.id)
      .then(repositories => Promise.all(repositories
        .map(repository => {
          debug(`scheduling "${repository.name}" for processing`);
          console.info(`count#scheduler.repositories=1`);
          return worker.sendAsync(`${installation.id},${repository.name}`);
        })
      ))
    )
  ))
  .then(() => worker.quit())
  .catch(error => {
    console.error(error);
    worker.quit();
  });
