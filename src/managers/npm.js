'use strict';

const debug = require(`debug`)(`deprecator`);
const got = require(`got`);
const registryUrl = require(`registry-url`);
const semver = require(`semver`);
const shell = require(`shelljs`);

const url = require(`url`);

module.exports = npmFactory(shell);
module.exports.npm = npmFactory;

const RULE_METHODS = {
  all: () => true,
};

function npmFactory(shell) {
  function npm(dryRun, packageFileContents) {
    this.dryRun = dryRun;
    this.packageName = JSON.parse(packageFileContents).name;

    debug(`package name is - ${this.packageName}`);

    this.registry = registryUrl(this.packageName.split(`/`)[0]);
    this.packageUrl = url.resolve(
      this.registry,
      encodeURIComponent(this.packageName).replace(/^%40/, '@')
    );
  }

  npm.prototype.fetch = function () {
    return got(this.packageUrl, {json: true})
      .then(response => response.body)
      .then(this.saveMetadata.bind(this))
      .then(() => this)
    ;
  };

  npm.prototype.deprecate = function (chosenRules) {
    chosenRules.forEach(ruleName => {
      if (RULE_METHODS[ruleName] === undefined) {
        throw Error(`The following rule is not supported by the 'npm' manager - ${ruleName}`);
      }
    });

    const rules = chosenRules.map(enabledRule => RULE_METHODS[enabledRule]);

    if (rules.length === 0) {
      debug(`no rules to apply so exiting the deprecation process early`);
      return [];
    }

    // Clone for local modifications.
    const filteredMetadata = Object.assign({}, this.metadata);

    // Assign the version publish time to each version's metadata object.
    Object
      .keys(filteredMetadata.time)
      .filter(version => semver.valid(version) !== null)
      .forEach(version => {
        if (filteredMetadata.versions[version] === undefined) {
          debug(`did not find version '${version}' in the project's package metadata`);
        } else {
          filteredMetadata.versions[version]._time = filteredMetadata.time[version];
        }
      });

    const versions = Object.keys(filteredMetadata.versions);

    const deprecatePromises = versions
      .map(key => filteredMetadata.versions[key])

      // Retrieve only those versions that have not already been deprecated.
      .filter(versionMetadata => {
        if (versionMetadata.deprecated !== undefined) {
          debug(`ignoring version '${versionMetadata.version}' as it has already been deprecated with message - "${versionMetadata.deprecated}"`);
          return false;
        }

        return true;
      })

      // Filter versions based on whether they match our deprecation rules.
      .filter(versionMetadata => rules.some(rule => rule(versions, versionMetadata)))

      // Call `npm deprecate` on each version that needs to be deprecated.
      .map(versionMetadata => {
        debug(`calling 'deprecate' on version '${versionMetadata.version}'`);

        if (this.dryRun) {
          debug(`running in 'dry-run' mode so no deprecation will actually happen`);
        }

        return this.dryRun ? Promise.resolve(versionMetadata) : new Promise((resolve, reject) => {
          function callback(code, stdout, stderr) {
            debug(`results of 'npm deprecate' - code = "${code}", stdout = "${stdout}", stderr = "${stderr}"`);

            if (code !== 0) {
              return reject(new Error(`Failed to deprecate ${this.packageName}@${versionMetadata.version} - ${stderr}`));
            }

            return resolve(versionMetadata);
          }

          shell.exec(`npm deprecate ${this.packageName}@${versionMetadata.version} "This version is no longer supported. Please upgrade."`, {silent: true}, callback.bind(this));
        });
      });

    return Promise
      .all(deprecatePromises);
  };

  npm.prototype.saveMetadata = function (metadata) {
    this.metadata = metadata;
  };

  npm.packageMetadataFilePattern = {
    pattern: `**/package.json`,
    ignore: [`node_modules/**`],
  };

  return npm;
}

