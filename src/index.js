'use strict';

const condenseDeprecationInformation = require(`./utils/condense-deprecation-information`);
const debug = require(`debug`)(`deprecator`);
const lodash = require(`lodash`);
const {projects} = require(`./utils/projects`);
const shelljs = require(`shelljs`);

module.exports = deprecator();
module.exports.deprecator = deprecator;

function deprecator(customShell) {
  const shell = customShell || shelljs;

  return config => config.rules === Object(config.rules) ?
    Promise.resolve(config)
      .then(config => {
        config = Object.assign({}, config, {});
        debug(`deprecation configuration - %O`, lodash.omit(config, [`token`]));
        return config;
      })
      .then(config => projects(shell)(config))
      .then(projects => Promise.all(projects.map(project => project.fetch())))
      .then(projects => Promise.all(projects.map(project => project.deprecate(config.rules))))
      .then(condenseDeprecationInformation) :
    Promise.reject(new Error(`Must provide a 'rules' property as an object in the configuration.`));
}
