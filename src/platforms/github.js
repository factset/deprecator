'use strict';

const debug = require(`debug`)(`deprecator`);
const got = require(`got`);
const jsonwebtoken = require(`jsonwebtoken`);

module.exports = {
  createApplicationToken,
  createInstallationToken,
  fetchInstallations,
  fetchInstallationRepositories,
  getApplicationID,
  getApplicationKey,
  getEndpoint,
  getRateLimitRemaining,
};

function createApplicationToken(applicationID, applicationKey) {
  return jsonwebtoken.sign({
    iss: applicationID,
  }, applicationKey, {
    expiresIn: 300, algorithm: `RS256`,
  });
}

function createInstallationToken(applicationToken, endpoint, installationID) {
  debug(`creating installation token for "${installationID}" on "${endpoint}"`);

  return got.post(`${endpoint}/installations/${installationID}/access_tokens`, {
    json: true,
    headers: {
      accept: `application/vnd.github.machine-man-preview+json`,
      authorization: `Bearer ${applicationToken}`,
    },
  }).then(response => response.body.token);
}

function fetchInstallations(applicationToken, endpoint) {
  debug(`fetching all installations`);

  return got(`${endpoint}/app/installations`, {
    json: true,
    headers: {
      accept: `application/vnd.github.machine-man-preview+json`,
      authorization: `Bearer ${applicationToken}`,
    },
  })
    .then(response => response.body);
}

function fetchInstallationRepositories(applicationToken, endpoint, installationID) {
  debug(`fetching installation - ${installationID}`);

  return createInstallationToken(applicationToken, endpoint, installationID)
    .then(token => {
      return got(`${endpoint}/installation/repositories`, {
        json: true,
        headers: {
          accept: `application/vnd.github.machine-man-preview+json`,
          authorization: `token ${token}`,
        },
      })
        .then(response => response.body.repositories)
        .then(repositories => repositories.map(repository => repository.full_name))
        .then(repositories => repositories.map(repository => ({name: repository, token})));
    })
    .then(repositories => {
      debug(`found the following repositories for installation ${installationID} - %O`, repositories.map(repository => repository.name));
      return repositories;
    });
}

function getApplicationID() {
  const applicationID = process.env.GITHUB_APPLICATION_ID;
  if (!applicationID) {
    throw new Error(`You must define 'GITHUB_APPLICATION_ID' as an environment variable.`);
  }
  return applicationID;
}

function getApplicationKey() {
  const applicationKey = process.env.GITHUB_APPLICATION_KEY;
  if (!applicationKey) {
    throw new Error(`You must define 'GITHUB_APPLICATION_KEY' as an environment variable.`);
  }
  return applicationKey;
}

function getEndpoint() {
  const endpoint = process.env.GITHUB_ENDPOINT;
  if (!endpoint) {
    throw new Error(`You must define 'GITHUB_ENDPOINT' as an environment variable.`);
  }
  return endpoint;
}

function getRateLimitRemaining(endpoint, token) {
  return got(`${endpoint}/rate_limit`, {
    json: true,
    headers: {
      authorization: `token ${token}`,
    },
  }).then(response => response.body.resources.core.remaining);
}
