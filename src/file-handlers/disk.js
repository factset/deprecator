'use strict';

const bluebird = require(`bluebird`);
const glob = require(`glob`);
const debug = require(`debug`)(`deprecator`);
const fs = require(`fs`);

const fsAsync = bluebird.promisifyAll(fs);
const globAsync = bluebird.promisify(glob);

module.exports = {
  loadFiles,
};

function loadFiles(packageMetadataFilePattern) {
  debug(`loading files matching - %O`, packageMetadataFilePattern);

  return globAsync(packageMetadataFilePattern.pattern, {ignore: packageMetadataFilePattern.ignore})
    .then(files => debugAndReturn(`found the following files - %O`, files))
    .then(files => Promise.all(files.map(file => fsAsync.readFileAsync(file))))
    .then(filesContent => filesContent.map(fileContent => fileContent.toString()))
  ;
}

function debugAndReturn(message, value) {
  debug(message, value);
  return value;
}
