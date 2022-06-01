'use strict';

const tanimotoSimilarity = require('./tanimotoSimilarity');

module.exports = function bestMatch(targetFingerprint, fontData) {
  const bestMatch = {
    similarity: 0
  };

  for (const symbolFingerprint of fontData.fingerprint) {
    for (const fingerprint of symbolFingerprint.fingerprints) {
      const similarity = tanimotoSimilarity(fingerprint, targetFingerprint);
      if (similarity >= bestMatch.similarity) {
        bestMatch.similarity = similarity;
        bestMatch.fingerprintOptions = fingerprint;
        bestMatch.symbol = symbolFingerprint.symbol;
      }
    }
  }
  return bestMatch;
};
