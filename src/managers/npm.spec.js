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
const packageMetadata = require(`../mock/package.mock.json`);

chai.use(chaiAsPromised);
chai.use(sinonChai);
const expect = chai.expect;

const before = mocha.before;
const beforeEach = mocha.beforeEach;
const describe = mocha.describe;
const it = mocha.it;

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
      const months = 6;

      const majorVersions = rules.majorVersions(packageRegistryMetadata, months);

      const date = new Date();
      date.setMonth(date.getMonth() - (months + 1));

      expect(majorVersions({version: `3.0.0`, _time: date})).to.be.false;
    });

    it(`should return false if the current version is the 'latest' dist-tag`, () => {
      const months = 6;

      const majorVersions = rules.majorVersions(packageRegistryMetadata, months);

      const date = new Date();
      date.setMonth(date.getMonth() - (months + 1));

      expect(majorVersions({version: `3.0.1`, _time: date})).to.be.false;
    });

    it(`should return false for 'latest' dist-tag within allowed time range`, () => {
      const months = 6;

      const majorVersions = rules.majorVersions(packageRegistryMetadata, months);

      const date = new Date();
      date.setMonth(date.getMonth() - (months - 1));

      expect(majorVersions({version: `2.0.0`, _time: date})).to.be.false;
    });

    it(`should return true for 'latest' dist-tag outside of allowed time range`, () => {
      const months = 6;

      const majorVersions = rules.majorVersions(packageRegistryMetadata, months);

      const date = new Date();
      date.setMonth(date.getMonth() - (months + 1));

      expect(majorVersions({version: `2.0.0`, _time: date})).to.be.true;
    });
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
      Object.keys(modifiedMetadata.time).forEach(function (version) {
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
