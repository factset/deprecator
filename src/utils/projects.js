'use strict';

const debug = require(`debug`)(`deprecator`);
const diskHandler = require(`../file-handlers/disk`);
const RepositoryHandler = require(`../file-handlers/repository`);
const npm = require(`../managers/npm`);
const shelljs = require(`shelljs`);

const PACKAGE_MANAGERS = [
  {manager: npm.npm, patterns: npm.packageMetadataFilePattern},
  // Python?
];

module.exports = projects();
module.exports.projects = projects;

function projects(customShell, customPackageManagers) {
  const shell = customShell || shelljs;
  const packageManagers = customPackageManagers || PACKAGE_MANAGERS;

  return function (config) {
    let fileHandler;

    if (config.autoDiscover) {
      debug(`support for auto discovering repositories not yet implemented`);
      return Promise.resolve([]);
    }

    if (config.repository) {
      fileHandler = new RepositoryHandler(config);
    } else {
      fileHandler = diskHandler;
    }

    // Assume local project folder that may have a single package, or multiple package (monorepo).
    const promises = packageManagers.map(packageManager => fileHandler
      .loadFiles(packageManager.patterns)
      .then(filesContent => filesContent.map(fileContent => new (packageManager.manager(shell))(config, fileContent))));

    return Promise.all(promises).then(managerResults => managerResults.reduce((combinedResults, results) => combinedResults.concat(results), []));
  };
}
