'use strict';

const tanimotoSimilarity = require('./tanimotoSimilarity');

module.exports = function appendFingerprints(lines, options = {}) {
  const {
    maxSimilarity = 1 // over this value we don't add the fingerprintOptions
  } = options;
  for (const line of lines.lines) {
    if (!line.fingerprints) line.fingerprints = [];
    for (const roi of line.rois) {
      let isNew = true;
      for (const fingerprint of line.fingerprints) {
        if (tanimotoSimilarity(fingerprint, roi.data) >= maxSimilarity) {
          isNew = false;
          break;
        }
      }
      if (isNew) {
        line.fingerprints.push(roi.data);
      }
    }
  }
};
