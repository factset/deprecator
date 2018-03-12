'use strict';

const condenseDeprecationInformation = require(`./utils/condense-deprecation-information`);
const debug = require(`debug`)(`deprecator`);
const projects = require(`./projects`).projects;
const shell = require(`shelljs`);

module.exports = deprecator(shell);
module.exports.deprecator = deprecator;

function deprecator(shell) {
  return config => config.rules === Object(config.rules) ?
    Promise.resolve(config)
      .then(config => {
        config = Object.assign({}, config, {});
        debug(`deprecation configuration - %O`, config);
        return config;
      })
      .then(config => projects(shell)({autoDiscover: config.autoDiscover, dryRun: config.dryRun}))
      .then(projects => Promise.all(projects.map(project => project.fetch())))
      .then(projects => Promise.all(projects.map(project => project.deprecate(config.rules))))
      .then(condenseDeprecationInformation) :
    Promise.reject(new Error(`Must provide a 'rules' property as an object in the configuration.`));
}
