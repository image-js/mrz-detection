'use strict';

const getLinesFromImage = require('./util/getLinesFromImage');
const doOcrOnLines = require('./util/doOcrOnLines');
const setFingerprintDataOnRoi = require('./util/setFingerprintDataOnRoi');

module.exports = function runOCR(image, fontFingerprint, options = {}) {
  const lines = getLinesFromImage(image, options);
  setFingerprintDataOnRoi(lines, options.fingerprintOptions);
  return doOcrOnLines(lines, fontFingerprint, options.fingerprintOptions);
};
