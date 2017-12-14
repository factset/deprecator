#!/usr/bin/env node

'use strict';

const pkg = require(`../package.json`);
const program = require(`commander`);
const deprecator = require(`./index`);

program
  .description(pkg.description)
  .version(pkg.version)
  .parse(process.argv)
;

deprecator()
  .then(() => {
    console.log(`Success!`);
  })
  .catch(error => {
    console.error(`deprecator failed for the following reason - ${error}`);
    process.exit(1);
  });
