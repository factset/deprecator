'use strict';

/* eslint-disable no-unused-expressions */

const chai = require(`chai`);
const chaiAsPromised = require(`chai-as-promised`);
const mocha = require(`mocha`);
const nock = require(`nock`);

const index = require(`./index`);

chai.use(chaiAsPromised);
const expect = chai.expect;

const before = mocha.before;
const describe = mocha.describe;
const it = mocha.it;

describe(`deprecator`, () => {
  before(function () {
    nock.disableNetConnect();
  });

  it(`resolves`, () => {
    expect(index()).to.be.fulfilled;
  });
});
