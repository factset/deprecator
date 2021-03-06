'use strict';

const debug = require(`debug`)(`deprecator`);
const got = require(`got`);
const fs = require(`fs`);
const Moment = require(`moment`);
const path = require(`path`);
const registryUrl = require(`registry-url`);
const semver = require(`semver`);
const shelljs = require(`shelljs`);
const tmp = require(`tmp`);
const url = require(`url`);

module.exports = npmFactory();
module.exports.npm = npmFactory;
module.exports.rules = getRules();

function getRules() {
  return {
    // Deprecate all versions of a package.
    all: (/* metadata, option */) => (/* versionMetadata */) => true,

    /*
     * Deprecate all versions of a Major release line that were released ___
     * months before the current date, and are not part of the current Major release
     * line (The one pointed to by the `latest` dist-tag).
     */
    majorVersions: (metadata, monthsPassed) => {
      const latestMajor = semver.major(metadata[`dist-tags`].latest);

      const date = new Date();
      date.setMonth(date.getMonth() - Number(monthsPassed));

      return versionMetadata => (semver.major(versionMetadata.version) < latestMajor) &&
        (new Date(versionMetadata._time) < date);
    },

    /*
     * Deprecate all versions of a major release line in which the earliest version released in the next
     * major release line (the successor major version) has been out for at least ___ months.
     */
    majorVersionsBeforeSuccessor: (metadata, monthsPassed) => {
      const latestMajor = semver.major(metadata[`dist-tags`].latest);

      const monthsSinceRelease = Object.keys(metadata.versions).reduce(calculateReleaseTimes, {});

      const majorVersions = Object.keys(monthsSinceRelease).map(Number).sort();
      debug(`major versions - ${majorVersions}`);

      return versionMetadata => (semver.major(versionMetadata.version) < latestMajor) && (sinceSuccessorWasReleased(semver.major(versionMetadata.version)) > monthsPassed);

      function calculateReleaseTimes(sinceRelease, version) {
        const major = semver.major(version);

        if (sinceRelease[major]) {
          return sinceRelease;
        }

        const earliestVersionForReleaseLine = Object.keys(metadata.versions).filter(releaseVersion => semver.major(releaseVersion) === major).sort(semver.compare)[0];
        debug(`earliest release version for major version ${major} was ${earliestVersionForReleaseLine}`);

        // We want to know the number of months that have passed since this major version was initially released.
        sinceRelease[major] = Moment.duration((new Moment()).diff(new Moment(metadata.time[earliestVersionForReleaseLine]))).asMonths();
        debug(`major version ${major} was released ${sinceRelease[major]} months ago`);

        return sinceRelease;
      }

      function sinceSuccessorWasReleased(major) {
        const nextMajor = majorVersions[majorVersions.indexOf(major) + 1];
        debug(`after version ${major}, the next major version is  ${nextMajor}, and was released ${monthsSinceRelease[nextMajor]} months ago`);
        return monthsSinceRelease[nextMajor];
      }
    },

    minorVersionsBeforeSuccessor: (metadata, monthsPassed) => {
      const latestMajor = semver.major(metadata[`dist-tags`].latest);
      const latestMinor = semver.minor(metadata[`dist-tags`].latest);

      const monthsSinceRelease = Object.keys(metadata.versions).reduce(calculateReleaseTimes, {});

      return versionMetadata => {
        if (`${semver.major(versionMetadata.version)}.${semver.minor(versionMetadata.version)}` === `${latestMajor}.${latestMinor}`) {
          debug(`can't deprecate latest major.minor version ${latestMajor}.${latestMinor}`);
          return false;
        }
        return sinceSuccessorWasReleased(versionMetadata.version) > monthsPassed;
      };

      function calculateReleaseTimes(sinceRelease, version) {
        debug(`processing version ${version} for calculating release time`);

        const major = semver.major(version);
        const minor = semver.minor(version);

        if (sinceRelease[major] && sinceRelease[major][minor]) {
          debug(`skipping version ${version} as we have already calculated earliest release of version ${major}.${minor}.x`);
          return sinceRelease;
        }

        sinceRelease[major] = sinceRelease[major] || {};

        const earliestVersionForReleaseLine = Object.keys(metadata.versions).filter(releaseVersion => semver.major(releaseVersion) === major && semver.minor(releaseVersion) === minor).sort(semver.compare)[0];
        debug(`earliest release version for minor version ${major}.${minor}.x was ${earliestVersionForReleaseLine}`);

        // We want to know the number of months that have passed since this minor version was initially released.
        sinceRelease[major][minor] = Moment.duration((new Moment()).diff(new Moment(metadata.time[earliestVersionForReleaseLine]))).asMonths();
        debug(`minor version ${major}.${minor} was released ${sinceRelease[major][minor]} months ago`);

        return sinceRelease;
      }

      function sinceSuccessorWasReleased(version) {
        const major = semver.major(version);
        const minor = semver.minor(version);

        const minors = Object.keys(monthsSinceRelease[major]).map(Number).sort();
        const nextMinor = minors[minors.indexOf(minor) + 1];
        debug(`after version ${major}.${minor}, the next minor version is ${major}.${nextMinor}, and it was released ${monthsSinceRelease[major][nextMinor]} months ago`);
        return monthsSinceRelease[major][nextMinor];
      }
    },

    patchVersions: metadata /* , monthsPassed */ => {
      const {latest} = metadata[`dist-tags`];

      debug(`latest 'dist-tag' version is ${latest}`);

      const latestPatches = Object.keys(metadata.versions).reduce(calculateLatestPatches, {});

      debug(`latest patches are %O`, latestPatches);

      // Deprecate, return `true`, only if the version is not the latest patch on a given `major.minor` release.
      return versionMetadata => (versionMetadata.version !== latest) &&
        (versionMetadata.version !== latestPatches[semver.major(versionMetadata.version)][semver.minor(versionMetadata.version)]);

      function calculateLatestPatches(patches, version) {
        const major = semver.major(version);
        const minor = semver.minor(version);

        if (patches[major] === undefined) {
          patches[major] = {};
        }

        if (patches[major][minor] === undefined) {
          patches[major][minor] = version;
          return patches;
        }

        if (semver.gt(version, patches[major][minor])) {
          patches[major][minor] = version;
          return patches;
        }

        return patches;
      }
    },
  };
}

function npmFactory(customShell) {
  const shell = customShell || shelljs;

  function npm(config, packageFileContents) {
    this.dryRun = config.dryRun;
    this.packageName = JSON.parse(packageFileContents).name;

    debug(`creating npm handler for package '${this.packageName}'`);

    this.registry = registryUrl(this.packageName.split(`/`)[0]);

    debug(`using '${this.registry}' as the registry for package '${this.packageName}'`);

    this.packageUrl = url.resolve(
      this.registry,
      encodeURIComponent(this.packageName).replace(/^%40/, '@')
    );

    debug(`using '${this.packageUrl}' as the package URL for package '${this.packageName}'`);

    /*
     * Setup our temporary directory with any `npmrc` configuration, and our package contents.
     * Both are needed by the `npm deprecate` command to know which package to deprecate, and any authentication
     * credentials required by the registry.
     */
    this.tmpDir = tmp.dirSync();
    if (config.npmrc) {
      fs.writeFileSync(path.join(this.tmpDir.name, `.npmrc`), Buffer.from(config.npmrc, `base64`).toString());
    }
    fs.writeFileSync(path.join(this.tmpDir.name, `package.json`), packageFileContents);
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
      .then(() => this);
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

          shell.exec(`npm deprecate ${this.packageName}@${versionMetadata.version} "This version is no longer supported. Please upgrade." --ignore-scripts`, {
            cwd: this.tmpDir.name,
            silent: true,
          }, callback.bind(this));
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
