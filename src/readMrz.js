'use strict';

const { loadFontData } = require('ocr-tools');
const { join } = require('path');

const mrzOcr = require('./internal/mrzOcr');
const symbols = require('./internal/symbols'); // SYMBOLS MRZ NUMBERS

const fingerprintOptions = {
  baseDir: join(__dirname, '../fontData'),
  height: 12,
  width: 12,
  minSimilarity: 0.5,
  fontName: 'ocrb',
  category: symbols.label,
  ambiguity: true
};

const fontFingerprint = loadFontData(fingerprintOptions);

const roiOptions = {
  // minSurface: 300,
  positive: true,
  negative: false,
  minRatio: 0.3,
  maxRatio: 2.0,
  algorithm: 'otsu',
  randomColors: true
};

function readMrz(image) {
  var { ocrResult } = mrzOcr(image, fontFingerprint, {
    roiOptions,
    fingerprintOptions
  });

  return ocrResult.lines.map((line) => line.text);
}

module.exports = readMrz;
