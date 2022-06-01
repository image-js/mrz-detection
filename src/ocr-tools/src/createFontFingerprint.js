/* eslint-disable no-console */
'use strict';

const generateSymbolImage = require('../src/util/generateSymbolImage');
const appendFingerprints = require('../src/util/appendFingerprints');
const setFingerprintDataOnRoi = require('../src/util/setFingerprintDataOnRoi');

const getLinesFromImage = require('./util/getLinesFromImage');

module.exports = function createFontFingerprint(options = {}) {
  const { image } = generateSymbolImage(options.imageOptions);
  image.save(
    `png/${options.imageOptions.fontName}_${
      options.roiOptions.greyThreshold
    }.jpg`
  );
  const lines = getLinesFromImage(image, options);
  setFingerprintDataOnRoi(lines, options.fingerprintOptions);
  const symbols = options.imageOptions.symbols;

  let valid = true;
  // we have the lines in the correct order, it should match directly the font
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    line.symbol = String.fromCharCode(symbols[i]);
    if (line.rois.length !== options.imageOptions.numberPerLine) {
      console.log(
        `Number of symbol on the line not correct for: ${line.symbol}`
      );
      valid = false;
    }
  }
  if (lines.lines.length !== symbols.length) {
    console.log('Number of lines not correct: ', lines.length, symbols.length);
    valid = false;
  }

  appendFingerprints(lines, {
    maxSimilarity: options.fingerprintOptions.maxSimilarity
  });

  const results = lines.lines.map(function (line) {
    return {
      symbol: line.symbol,
      fingerprints: line.fingerprints
    };
  });

  return {
    valid,
    results,
    fontName: options.imageOptions.fontName
  };
};
