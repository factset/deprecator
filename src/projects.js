'use strict';

const diskHandler = require(`./file-handlers/disk`);
const npm = require(`./managers/npm`).npm;
const npmPatterns = require(`./managers/npm`).packageMetadataFilePattern;
const shell = require(`shelljs`);

module.exports = projects(shell);
module.exports.projects = projects;

function projects(shell) {
  return function (config) {
    let fileHandler;

    if (config.autoDiscover) {
      return Promise.resolve([]);
    }

    fileHandler = diskHandler;

    // Assume local project folder that may have a single package, or multiple package (monorepo).
    return fileHandler
      .loadFiles(npmPatterns)
      .then(filesContent => filesContent.map(fileContent => new (npm(shell))(config.dryRun, fileContent)));
  };
}
