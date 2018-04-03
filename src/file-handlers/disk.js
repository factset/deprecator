'use strict';

const bluebird = require(`bluebird`);
const debug = require(`debug`)(`deprecator`);
const debugAndReturn = require(`../utils/debug-and-return`);
const glob = require(`glob`);
const fs = require(`fs`);

const fsAsync = bluebird.promisifyAll(fs);
const globAsync = bluebird.promisify(glob);

module.exports = {
  loadFiles,
};

function loadFiles(packageMetadataFilePattern) {
  debug(`loading files matching - ${packageMetadataFilePattern}`);

  return globAsync(packageMetadataFilePattern)
    .then(files => debugAndReturn(`found the following files - %O`, files))
    .then(files => Promise.all(files.map(file => fsAsync.readFileAsync(file))))
    .then(filesContent => filesContent.map(fileContent => fileContent.toString()))
  ;
}
