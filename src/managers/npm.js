'use strict';

const debug = require(`debug`)(`deprecator`);
const got = require(`got`);
const registryUrl = require(`registry-url`);
const semver = require(`semver`);
const shelljs = require(`shelljs`);
const url = require(`url`);

module.exports = npmFactory();
module.exports.npm = npmFactory;
module.exports.rules = getRules();

function getRules() {
  return {
    all: (/* metadata, option */) => (/* versionMetadata */) => true,
    majorVersions: (metadata, option) => {
      const latestMajor = semver.major(metadata[`dist-tags`].latest);
      const date = new Date();
      date.setMonth(date.getMonth() - Number(option));

      return versionMetadata => (semver.major(versionMetadata.version) < latestMajor) &&
        (new Date(versionMetadata._time) < date);
    },
  };
}

function npmFactory(customShell) {
  const shell = customShell || shelljs;

  function npm(dryRun, packageFileContents) {
    this.dryRun = dryRun;
    this.packageName = JSON.parse(packageFileContents).name;

    debug(`creating npm handler for package '${this.packageName}'`);

    this.registry = registryUrl(this.packageName.split(`/`)[0]);

    debug(`using '${this.registry}' as the registry for package '${this.packageName}'`);

    this.packageUrl = url.resolve(
      this.registry,
      encodeURIComponent(this.packageName).replace(/^%40/, '@')
    );

    debug(`using '${this.packageUrl}' as the package URL for package '${this.packageName}'`);
  }

  npm.prototype.fetch = function () {
    return got(this.packageUrl, {json: true})
      .catch(error => {
        if (error.statusCode && error.statusMessage) {
          debug(`failed to fetch package, ${this.packageName}, metadata from the registry - ${error.statusCode} - ${error.statusMessage}`, error.response ? error.response.body : ``);
        } else {
          debug(`failed to fetch package, ${this.packageName}, metadata from the registry - ${error}`);
        }
        throw error;
      })
      .then(response => response.body)
      .then(this.saveMetadata.bind(this))
      .then(() => this)
    ;
  };

  npm.prototype.deprecate = function (chosenRules) {
    if (Object.keys(chosenRules).length === 0) {
      debug(`no rules to apply so exiting the deprecation process early`);
      return [];
    }

    Object.keys(chosenRules).forEach(ruleName => {
      if (module.exports.rules[ruleName] === undefined) {
        throw Error(`The following rule is not supported by the 'npm' manager - ${ruleName}`);
      }
    });

    const rules = Object.keys(chosenRules)
      .map(ruleName => module.exports.rules[ruleName](this.metadata, chosenRules[ruleName]));

    const deprecatePromises = Object.keys(this.metadata.versions).map(key => this.metadata.versions[key])

      // Retrieve only those versions that have not already been deprecated.
      .filter(versionMetadata => {
        if (versionMetadata.deprecated !== undefined) {
          debug(`ignoring version '${versionMetadata.version}' of '${versionMetadata.name}' as it has already been deprecated with message - "${versionMetadata.deprecated}"`);
          return false;
        }

        return true;
      })

      // Filter versions based on whether they match our deprecation rules.
      .filter(versionMetadata => rules.some(rule => rule(versionMetadata)))

      // Call `npm deprecate` on each version that needs to be deprecated.
      .map(versionMetadata => {
        debug(`calling 'deprecate' on version '${versionMetadata.version}' of '${versionMetadata.name}'${this.dryRun ? ` - running in dry run mode` : ``}`);

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

    return Promise.all(deprecatePromises);
  };

  npm.prototype.saveMetadata = function (metadata) {
    this.metadata = metadata;

    // Assign the version publish time to each version's metadata object.
    Object
      .keys(this.metadata.time)
      .filter(version => semver.valid(version) !== null)
      .forEach(version => {
        if (this.metadata.versions[version] === undefined) {
          debug(`did not find version '${version}', specified in 'time' list, in the project's package metadata`);
        } else {
          this.metadata.versions[version]._time = this.metadata.time[version];
        }
      });
  };

  npm.packageMetadataFilePattern = `**/package.json`;

  return npm;
}

