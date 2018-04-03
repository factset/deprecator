'use strict';

const debug = require(`debug`)(`deprecator`);
const debugAndReturn = require(`../utils/debug-and-return`);
const got = require(`got`);
const minimatch = require(`minimatch`);

module.exports = repository;

function repository(config) {
  this.endpoint = config.endpoint;
  this.repository = config.repository;
  this.token = config.token;
}

repository.prototype.loadFiles = function (packageMetadataFilePattern) {
  debug(`loading files matching - %O`, packageMetadataFilePattern);

  switch (`github`) {
    case 'github':
      return this.fetchGitHubFiles(packageMetadataFilePattern);
    default:
      throw new Error(`Could not determine source code platform this ${this.repository}`);
  }
};

repository.prototype.fetchGitHubFiles = function (packageMetadataFilePattern) {
  const config = {
    json: true,
    headers: {
      accept: `application/vnd.github.machine-man-preview+json`,
      authorization: `token ${this.token}`,
    },
  };

  return got(`${this.endpoint}/repos/${this.repository}`, config)
    .then(response => got(`${this.endpoint}/repos/${this.repository}/git/trees/${response.body.default_branch}?recursive=1`, config))
    .then(response => {
      if (response.body.truncated) {
        debug(`the repository tree was truncated when fetching ${this.repository}`);
      }
      return response.body.tree;
    })
    .then(files => debugAndReturn(`the following files were found - %O`, files))
    .then(files => files.filter(file => minimatch(file.path, packageMetadataFilePattern)))
    .then(files => debugAndReturn(`the following files matched package pattern - %O`, files))
    .then(files => Promise.all(files.map(file => got(file.url, config))))
    .then(responses => responses.map(response => Buffer.from(response.body.content, `base64`).toString()))
    .catch(error => {
      if (error.statusCode && error.statusMessage) {
        debug(`${error.statusCode} - ${error.statusMessage}`, error.response ? error.response.body : ``);
      } else {
        debug(error);
      }

      return [];
    });
};
