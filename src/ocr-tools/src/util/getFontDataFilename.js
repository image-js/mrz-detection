'use strict';

const { join } = require('path');

module.exports = function getFingerprintsName(options = {}) {
  var {
    width = 8,
    height = 8,
    category = '',
    fontName = 'helvetica',
    baseDir = 'fontFingerprint'
  } = options;

  fontName = fontName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
  fontName = fontName.replace(/_?regular$/, '');

  const kind = `${width}x${height}`;
  return {
    folder: join(baseDir, kind, category),
    name: `${fontName}.json`
  };
};
