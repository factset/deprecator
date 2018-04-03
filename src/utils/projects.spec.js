'use strict';

/* eslint-disable no-unused-expressions */

const chai = require(`chai`);
const chaiAsPromised = require(`chai-as-promised`);
const fs = require(`fs`);
const mocha = require(`mocha`);
const path = require(`path`);
const projects = require(`./projects`);
const projectsFactory = require(`./projects`).projects;
const sinon = require(`sinon`);
const sinonChai = require(`sinon-chai`);
const tmp = require(`tmp`);

chai.use(chaiAsPromised);
chai.use(sinonChai);
const expect = chai.expect;

const afterEach = mocha.afterEach;
const beforeEach = mocha.beforeEach;
const describe = mocha.describe;
const it = mocha.it;

describe.only(`projects`, function () {
  // Setting up our fake project takes longer than the default Mocha timeout.
  this.timeout(20000);

  it(`should be a function`, () => {
    expect(projects).to.be.a(`function`);
    expect(projectsFactory()).to.be.a(`function`);
  });

  describe(`auto discover`, () => {
    it(`should return an empty list of managers`, () => {
      const projects = projectsFactory(null, this.packageManagers)({
        autoDiscover: true,
      });

      return expect(projects).to.be.a(`promise`).and.to.be.fulfilled
        .then(managers => expect(managers).to.have.length(0));
    });
  });

  describe.skip(`repository handler`, () => {});

  describe(`disk handler`, () => {
    beforeEach(function () {
      this.packageManagers = [];

      this.mockNpm = sinon.stub();
      this.mockNpm.returns(function () {});

      this.packageManagers.push({
        manager: this.mockNpm,
        patterns: `**/package.json`,
      });

      this.config = {};

      this.cwd = process.cwd();
      this.tmpDir = tmp.dirSync();
      process.chdir(this.tmpDir.name);

      fs.writeFileSync(`package.json`, `{"name":"deprecator"}`);
      fs.copyFileSync(path.join(this.cwd, `.npmrc`), path.join(this.tmpDir.name, `.npmrc`));
    });

    afterEach(function () {
      process.chdir(this.cwd);
    });

    it(`won't instantiate a package manager is there's no package file`, function () {
      this.packageManagers[0].patterns = ``;

      const projects = projectsFactory(null, this.packageManagers)(this.config);

      return expect(projects).to.be.a(`promise`).and.to.be.fulfilled
        .then(managers => {
          expect(this.mockNpm).to.not.have.been.called;
          expect(managers).to.have.length(0);
        });
    });

    it(`should instantiate package manager`, function () {
      const projects = projectsFactory(null, this.packageManagers)(this.config);

      return expect(projects).to.be.a(`promise`).and.to.be.fulfilled
        .then(managers => {
          expect(this.mockNpm).to.have.been.calledOnce;
          expect(managers).to.have.length(1);
        });
    });

    it(`should instantiate multiple managers`, function () {
      this.packageManagers.push({
        manager: this.mockNpm,
        patterns: `**/package.json`,
      });

      const projects = projectsFactory(null, this.packageManagers)(this.config);

      return expect(projects).to.be.a(`promise`).and.to.be.fulfilled
        .then(managers => {
          expect(this.mockNpm).to.have.been.calledTwice;
          expect(managers).to.have.length(2);
        });
    });
  });
});
