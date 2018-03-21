'use strict';

const { join } = require('path');

const { loadFontData } = require('ocr-tools');

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
  minSurface: 20,
  minRatio: 0.3,
  maxRatio: 3.0,
  algorithm: 'otsu',
  randomColors: true
};

async function readMrz(image, options = {}) {
  var { ocrResult, mask } = await mrzOcr(image, fontFingerprint, {
    method: 'svm',
    roiOptions,
    fingerprintOptions
  });

  if (options.saveName) {
    mask.save(options.saveName);
  }

  return ocrResult;
  // return ocrResult.lines.map((line) => line.text);
}

module.exports = readMrz;
