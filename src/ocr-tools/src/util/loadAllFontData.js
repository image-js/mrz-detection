'use strict';

const fs = require('fs');
const { join } = require('path');

var getFontDataFilename = require('./getFontDataFilename');

module.exports = function loadAllFontData(options = {}) {
  var fingerprints = [];

  var folder = getFontDataFilename(options).folder;

  var dir = fs.readdirSync(folder);

  for (var file of dir) {
    var fontData = JSON.parse(fs.readFileSync(join(folder, file)));
    fontData.filneme = folder + file;
    fingerprints.push(fontData);
  }

  return fingerprints;
};
