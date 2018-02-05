'use strict';

const debug = require(`debug`)(`deprecator`);

module.exports = condenseDeprecationInformation;

function condenseDeprecationInformation(deprecatedProjects) {
  debug(`deprecated projects - %O`, deprecatedProjects);

  const condensedDeprecatedProjects = {};
  deprecatedProjects.forEach(projectVersions => {
    projectVersions.forEach(versionMetadata => {
      if (condensedDeprecatedProjects[versionMetadata.name] === undefined) {
        condensedDeprecatedProjects[versionMetadata.name] = [];
      }
      condensedDeprecatedProjects[versionMetadata.name].push(versionMetadata.version);
    });
  });
  return condensedDeprecatedProjects;
}
