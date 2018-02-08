#!/usr/bin/env node

'use strict';

const debug = require(`debug`)(`deprecator`);
const pkg = require(`../package.json`);
const program = require(`commander`);
const deprecator = require(`./index`);

program
  .description(pkg.description)
  .version(pkg.version)
  .option(`-r, --rules <rule,...>`, `Comma-separated list of rule names to determine which versions to deprecate`, val => val.split(`,`))
  .option(`-d --dry-run`, `Run as if deprecating versions of a package, but don't actually deprecate anything.`)
  .parse(process.argv)
;

deprecator({
  autoDiscover: program.autoDiscover,
  dryRun: program.dryRun,
  rules: program.rules || [],
})
  .then(deprecatedVersions => Object.keys(deprecatedVersions).length === 0 ?
    `No versions needed to be deprecated.` :
    `We have deprecated the following versions - ${JSON.stringify(deprecatedVersions)}`)
  .then(console.log)
  .catch(error => {
    debug(`stack trace - ${error.stack}`);
    console.error(`deprecator failed for the following reason - ${error}`);
    process.exit(1);
  });
