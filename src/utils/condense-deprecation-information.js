'use strict';

module.exports = condenseDeprecationInformation;

function condenseDeprecationInformation(deprecatedProjects) {
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
