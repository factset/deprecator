'use strict';

const debug = require(`debug`)(`deprecator`);

module.exports = () => deprecator();
module.exports.deprecator = deprecator;

function deprecator() {
  return new Promise(resolve => {
    debug(`success`);
    resolve();
  });
}
