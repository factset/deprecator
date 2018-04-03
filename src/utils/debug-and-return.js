'use strict';

const debug = require(`debug`)(`deprecator`);

module.exports = (message, value) => {
  debug(message, value);
  return value;
};
