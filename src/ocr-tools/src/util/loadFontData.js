'use strict';

const fs = require('fs');
const { join } = require('path');

var getFontDataFilename = require('./getFontDataFilename');

module.exports = function loadFontData(options = {}) {
  var file = getFontDataFilename(options);
  return JSON.parse(fs.readFileSync(join(file.folder, file.name)));
};
