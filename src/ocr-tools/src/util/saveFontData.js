'use strict';


const fs = require('fs');

const mkdirp = require('mkdirp');

const getFingerprintName = require('./getFontDataFilename');

module.exports = function saveFingerprint(fingerprint, options = {}) {
  const file = getFingerprintName(options);
  mkdirp.sync(file.folder);

  fs.writeFileSync(
    file.folder + file.name,
    JSON.stringify({
      font: options.fontName,
      fingerprint
    })
  );
};
