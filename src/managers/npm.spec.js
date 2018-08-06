'use strict';

/* eslint-disable no-unused-expressions */

const chai = require(`chai`);
const chaiAsPromised = require(`chai-as-promised`);
const mocha = require(`mocha`);
const nock = require(`nock`);
const npm = require(`./npm`).npm;
const rules = require(`./npm`).rules;
const sinon = require(`sinon`);
const sinonChai = require(`sinon-chai`);
const packageRegistryMetadata = require(`../mock/package-registry.mock.json`);
const packageRegistryMetadataMajorVersionsBeforeSuccessor = require(`../mock/package-registry.majorVersionsBeforeSuccessor.mock.json`);
const packageRegistryMetadataMinorVersionsBeforeSuccessor = require(`../mock/package-registry.minorVersionsBeforeSuccessor.mock.json`);
const packageMetadata = require(`../mock/package.mock.json`);

chai.use(chaiAsPromised);
chai.use(sinonChai);
const expect = chai.expect;

const MONTHS = 6;

const before = mocha.before;
const beforeEach = mocha.beforeEach;
const describe = mocha.describe;
const it = mocha.it;

function monthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
}

describe(`rules`, () => {
  describe(`all`, () => {
    it(`always returns true`, () => {
      const all = rules.all();
      expect(all()).to.be.true;
      expect(all({})).to.be.true;
    });
  });

  describe(`majorVersions`, () => {
    it(`throws an error when not passed valid arguments`, () => {
      expect(rules.majorVersions).to.throw(Error);
      expect(() => rules.majorVersions({})).to.throw(Error);
    });

    it(`should return false if the current version is the same major as the 'latest' dist-tag`, () => {
      const majorVersions = rules.majorVersions(packageRegistryMetadata, MONTHS);

      expect(majorVersions({version: `3.0.0`, _time: monthsAgo(MONTHS + 1)})).to.be.false;
    });

    it(`should return false if the current version is the 'latest' dist-tag`, () => {
      const majorVersions = rules.majorVersions(packageRegistryMetadata, MONTHS);

      expect(majorVersions({version: `3.0.1`, _time: monthsAgo(MONTHS + 1)})).to.be.false;
    });

    it(`should return false for old major when it's within the allowed time range`, () => {
      const majorVersions = rules.majorVersions(packageRegistryMetadata, MONTHS);

      expect(majorVersions({version: `2.0.0`, _time: monthsAgo(MONTHS - 1)})).to.be.false;
    });

    it(`should return true for old major when it's outside of the allowed time range`, () => {
      const majorVersions = rules.majorVersions(packageRegistryMetadata, MONTHS);

      expect(majorVersions({version: `2.0.0`, _time: monthsAgo(MONTHS + 1)})).to.be.true;
    });
  });

  describe(`majorVersionsBeforeSuccessor`, () => {
    it(`throws an error when not passed valid arguments`, () => {
      expect(rules.majorVersionsBeforeSuccessor).to.throw(Error);
      expect(() => rules.majorVersionsBeforeSuccessor({})).to.throw(Error);
    });

    it(`should return false if the current version is the 'latest' dist-tag`, () => {
      packageRegistryMetadataMajorVersionsBeforeSuccessor.time[`3.0.1`] = monthsAgo(MONTHS + 1);

      const majorVersions = rules.majorVersionsBeforeSuccessor(packageRegistryMetadataMajorVersionsBeforeSuccessor, MONTHS);

      expect(majorVersions({version: `3.0.1`})).to.be.false;
    });

    it(`should return false for current major when it's outside of the allowed time range`, () => {
      packageRegistryMetadataMajorVersionsBeforeSuccessor.time[`3.0.0`] = monthsAgo(MONTHS + 1);

      const majorVersions = rules.majorVersionsBeforeSuccessor(packageRegistryMetadataMajorVersionsBeforeSuccessor, MONTHS);

      expect(majorVersions({version: `3.0.0`})).to.be.false;
    });

    it(`should return false for old major when it's within the allowed time range`, () => {
      packageRegistryMetadataMajorVersionsBeforeSuccessor.time[`3.0.0`] = monthsAgo(MONTHS - 1);

      const majorVersions = rules.majorVersionsBeforeSuccessor(packageRegistryMetadataMajorVersionsBeforeSuccessor, MONTHS);

      expect(majorVersions({version: `2.0.0`})).to.be.false;
      expect(majorVersions({version: `2.0.1`})).to.be.false;
    });

    it(`should return true for old major when it's outside of the allowed time range`, () => {
      packageRegistryMetadataMajorVersionsBeforeSuccessor.time[`3.0.0`] = monthsAgo(MONTHS + 1);

      const majorVersions = rules.majorVersionsBeforeSuccessor(packageRegistryMetadataMajorVersionsBeforeSuccessor, MONTHS);

      expect(majorVersions({version: `2.0.0`})).to.be.true;
      expect(majorVersions({version: `2.0.1`})).to.be.true;
    });
  });

  describe(`minorVersionsBeforeSuccessor`, () => {
    it(`throws an error when not passed valid arguments`, () => {
      expect(rules.minorVersionsBeforeSuccessor).to.throw(Error);
      expect(() => rules.minorVersionsBeforeSuccessor({})).to.throw(Error);
    });

    it(`should return false for the latest minor version`, () => {
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.2.0`] = monthsAgo(MONTHS + 1);

      const minorVersions = rules.minorVersionsBeforeSuccessor(packageRegistryMetadataMinorVersionsBeforeSuccessor, MONTHS);

      expect(minorVersions({version: `2.2.0`}), `2.2.0`).to.be.false;
    });

    it(`should return false for old minor versions when all their successors are within the allowed time range`, () => {
      [`2.0.0`, `2.1.0`, `2.1.1`].forEach(version => {
        packageRegistryMetadataMinorVersionsBeforeSuccessor.time[version] = monthsAgo(MONTHS - 1);
      });
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.2.0`] = monthsAgo(MONTHS - 1);

      const minorVersions = rules.minorVersionsBeforeSuccessor(packageRegistryMetadataMinorVersionsBeforeSuccessor, MONTHS);

      expect(minorVersions({version: `2.0.0`}), `2.0.0`).to.be.false;
      expect(minorVersions({version: `2.1.0`}), `2.1.0`).to.be.false;
      expect(minorVersions({version: `2.1.1`}), `2.1.1`).to.be.false;
      expect(minorVersions({version: `2.2.0`}), `2.2.0`).to.be.false;
    });

    it(`should return true for the first old minor version when it's successor is outside of the allowed time range`, () => {
      // Minor version 2.1 must have been out for at least _MONTHS_ before the previous
      // minor 2.0 is considered unsupported/deprecated.
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.0.0`] = monthsAgo(MONTHS + 1);
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.1.0`] = monthsAgo(MONTHS + 1);
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.1.1`] = monthsAgo(MONTHS - 1);
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.2.0`] = monthsAgo(MONTHS - 1);

      const minorVersions = rules.minorVersionsBeforeSuccessor(packageRegistryMetadataMinorVersionsBeforeSuccessor, MONTHS);

      expect(minorVersions({version: `2.0.0`}), `2.0.0`).to.be.true;

      // Because minor version 2.2 has not been out for at least _MONTHS_ the previous
      // minor version 2.1 is still considered supported.
      expect(minorVersions({version: `2.1.0`}), `2.1.0`).to.be.false;
      expect(minorVersions({version: `2.1.1`}), `2.1.1`).to.be.false;

      expect(minorVersions({version: `2.2.0`}), `2.2.0`).to.be.false;
    });

    it(`should return true for all patches on a minor when a minor's successor is outside of the allowed time range`, () => {
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.0.0`] = monthsAgo(MONTHS + 1);
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.1.0`] = monthsAgo(MONTHS + 1);

      // Intentionally "released" after the minor successor has been released. Though this was released after it's minor
      // successor, it will still be marked as deprecated because it's successor has been out for the given number of months.
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.1.1`] = monthsAgo(MONTHS - 1);
      packageRegistryMetadataMinorVersionsBeforeSuccessor.time[`2.2.0`] = monthsAgo(MONTHS + 1);

      const minorVersions = rules.minorVersionsBeforeSuccessor(packageRegistryMetadataMinorVersionsBeforeSuccessor, MONTHS);

      expect(minorVersions({version: `2.0.0`}), `2.0.0`).to.be.true;
      expect(minorVersions({version: `2.1.0`}), `2.1.0`).to.be.true;
      expect(minorVersions({version: `2.1.1`}), `2.1.1`).to.be.true;
      expect(minorVersions({version: `2.2.0`}), `2.2.0`).to.be.false;
    });
  });

  describe(`patchVersions`, () => {
    it(`throws an error when not passed valid arguments`, () => {
      expect(rules.patchVersions).to.throw(Error);
      expect(() => rules.minorVersionsBeforeSuccessor({})).to.throw(Error);
    });

    it(`throws an error when given a version that does not exist`, () => {
      expect(rules.patchVersions).to.throw(Error);
      expect(() => rules.minorVersionsBeforeSuccessor({version: `4.0.0`})).to.throw(Error);
    });

    it(`should return false if the current version is the same as the 'latest' dist-tag`, () => {
      // Set the `latest` dist-tag to a version that is older than the latest patch for that
      // major.minor release line. Perhaps there was a serious bug and the developer needed to
      // revert `latest` to an earlier patch. We don't want to deprecate the patch version associated
      // with `latest`.
      const registryMetadata = Object.assign({}, packageRegistryMetadata, {'dist-tags': {latest: `3.0.0`}});
      const patchVersions = rules.patchVersions(registryMetadata);

      expect(patchVersions({version: `3.0.0`})).to.be.false;
    });

    it(`should return false if the version is the last patch for a given major.minor version`, () => {
      const patchVersions = rules.patchVersions(packageRegistryMetadata);

      // Expect(patchVersions({version: `1.0.0`})).to.be.false;
      // Expect(patchVersions({version: `2.0.0`})).to.be.false;
      expect(patchVersions({version: `3.0.1`})).to.be.false;
    });

    it(`should return true if the version is not the last patch for a given major.minor version`, () => {
      const patchVersions = rules.patchVersions(packageRegistryMetadata);

      expect(patchVersions({version: `3.0.0`})).to.be.true;
    });

    it.skip(`should return true if the patch version is the latest patch release, but it's not the latest dist-tag`);
  });
});

describe(`npm`, function () {
  // Setting up our fake project takes longer than the default Mocha timeout.
  this.timeout(20000);

  before(() => {
    nock.disableNetConnect();
  });

  beforeEach(function () {
    this.shell = {
      exec: sinon.stub(),
    };

    this.shell.exec.yields(0, ``, ``);
  });

  describe(`constructor`, () => {
    beforeEach(function () {
      this.npm = npm(this.shell);
    });

    it.skip(`throws exception for invalid package JSON`);

    it.skip(`throws exception when missing package name in metadata`);
  });

  describe(`deprecator`, () => {
    it(`throws exception if rules isn't an object`, function () {
      const npmManager = new (npm(this.shell))(false, JSON.stringify(packageMetadata));
      expect(npmManager.deprecate).to.throw(Error);
    });

    it(`returns empty list when no rules are provided`, function () {
      const npmManager = new (npm(this.shell))(false, JSON.stringify(packageMetadata));
      expect(npmManager.deprecate({})).to.deep.equal([]);
    });

    it(`throws exception for an invalid rule`, function () {
      const npmManager = new (npm(this.shell))(false, JSON.stringify(packageMetadata));
      expect(() => npmManager.deprecate({invalid: null})).to.throw(Error, `The following rule is not supported by the 'npm' manager - invalid`);
    });

    it(`deprecates all versions of the package for 'all' rule`, function () {
      const scope = nock(`https://registry.yarnpkg.com`)
        .get(`/deprecator`)
        .reply(200, JSON.stringify(packageRegistryMetadata));

      const npmManager = new (npm(this.shell))(false, JSON.stringify(packageMetadata));

      return npmManager.fetch()
        .then(() => scope.done())
        .then(() => npmManager.deprecate({all: null}))
        .then(results => {
          expect(results).to.be.an(`array`)
            .and.to.have.length(3)
            .and.to.deep.include({name: `deprecator`, version: `2.0.1`, _time: `2018-01-29T18:00:00.000Z`})
            .and.to.deep.include({name: `deprecator`, version: `3.0.0`, _time: `2018-01-30T18:00:00.000Z`})
            .and.to.deep.include({name: `deprecator`, version: `3.0.1`, _time: `2018-01-30T18:00:00.000Z`});
        })
        .then(() => expect(this.shell.exec.firstCall).calledWith(`npm deprecate deprecator@2.0.1 "This version is no longer supported. Please upgrade." --ignore-scripts`))
        .then(() => expect(this.shell.exec.secondCall).calledWith(`npm deprecate deprecator@3.0.0 "This version is no longer supported. Please upgrade." --ignore-scripts`))
        .then(() => expect(this.shell.exec.thirdCall).calledWith(`npm deprecate deprecator@3.0.1 "This version is no longer supported. Please upgrade." --ignore-scripts`));
    });

    it(`deprecates undeprecated majors that are not 'latest' dist-tag`, function () {
      const date = new Date();
      date.setMonth(date.getMonth() - 7);

      const modifiedMetadata = Object.assign({}, packageRegistryMetadata);
      Object.keys(modifiedMetadata.time).forEach(version => {
        modifiedMetadata.time[version] = date.toISOString();
      });

      const scope = nock(`https://registry.yarnpkg.com`)
        .get(`/deprecator`)
        .reply(200, JSON.stringify(modifiedMetadata));

      const npmManager = new (npm(this.shell))(false, JSON.stringify(modifiedMetadata));

      return npmManager.fetch()
        .then(() => scope.done())
        .then(() => npmManager.deprecate({majorVersions: 6}))
        .then(results => {
          expect(results).to.be.an(`array`)
            .and.to.have.length(1)
            .and.to.deep.include({name: `deprecator`, version: `2.0.1`, _time: modifiedMetadata.time[`2.0.1`]});
        })
        .then(() => expect(this.shell.exec.firstCall).calledWith(`npm deprecate deprecator@2.0.1 "This version is no longer supported. Please upgrade." --ignore-scripts`));
    });
  });
});
