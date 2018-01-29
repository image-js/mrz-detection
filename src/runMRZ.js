'use strict';

const { getLinesFromImage, doOcrOnLines } = require('ocr-tools');

module.exports = function runOCR(image, fontFingerprint, options = {}) {
  let { lines, mask, painted, averageSurface } = getLinesFromImage(
    image,
    options
  );

  lines = lines.filter((line) => line.rois.length > 20);
  // we should make a filter by ROI size ?

  // we keep maximum the last 3 lines
  if (lines.length > 3) {
    lines = lines.slice(lines.length - 3, lines.length);
  }

  var ocrOptions = Object.assign({}, options.fingerprintOptions, {
    maxNotFound: 411
  });

  var ocrResult = doOcrOnLines(lines, fontFingerprint, ocrOptions);

  return {
    ocrResult,
    mask,
    painted,
    averageSurface
  };
};
