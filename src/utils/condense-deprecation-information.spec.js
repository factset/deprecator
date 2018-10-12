'use strict';

/* eslint-disable no-unused-expressions */

const {expect} = require(`chai`);
const condenseDeprecationInformation = require(`./condense-deprecation-information`);
const {describe, it} = require(`mocha`);

describe(`condense-deprecation-information`, () => {
  it(`should return empty object`, () => {
    expect(() => condenseDeprecationInformation()).to.throw(TypeError);
    expect(() => condenseDeprecationInformation({})).to.throw(TypeError);
    expect(condenseDeprecationInformation([[]])).to.be.an(`object`).and.to.be.empty;
    expect(condenseDeprecationInformation([[]])).to.be.an(`object`).and.to.be.empty;
  });

  it(`should return all versions for a deprecated project`, () => {
    const deprecatedProjects = [
      [
        {
          name: `test`,
          version: `1.0.0`,
        },
        {
          name: `test`,
          version: `2.0.0`,
        },
      ],
    ];
    const results = condenseDeprecationInformation(deprecatedProjects);

    expect(results).be.an(`object`).and.to.have.key(`test`);
    expect(results[Object.keys(results)[0]]).to.have.lengthOf(2);
    expect(results[Object.keys(results)[0]]).to.include.members([`1.0.0`, `2.0.0`]);
  });

  it(`should return all versions for multiple deprecated projects`, () => {
    const deprecatedProjects = [
      [
        {
          name: `test`,
          version: `1.0.0`,
        },
        {
          name: `test`,
          version: `2.0.0`,
        },
      ],
      [
        {
          name: `another`,
          version: `1.0.0`,
        },
        {
          name: `another`,
          version: `3.0.0`,
        },
      ],
    ];
    const results = condenseDeprecationInformation(deprecatedProjects);

    expect(results).be.an(`object`).and.to.have.key(`test`, `another`);
    expect(results[Object.keys(results)[0]]).to.have.lengthOf(2);
    expect(results[Object.keys(results)[0]]).to.include.members([`1.0.0`, `2.0.0`]);
    expect(results[Object.keys(results)[1]]).to.have.lengthOf(2);
    expect(results[Object.keys(results)[1]]).and.to.include.members([`1.0.0`, `3.0.0`]);
  });
});
