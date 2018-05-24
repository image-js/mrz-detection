'use strict';

const { getLinesFromImage, doOcrOnLines } = require('ocr-tools');

const { predictImages } = require('../svm');

async function mrzOcr(image, fontFingerprint, options = {}) {
  options = Object.assign({}, { method: 'svm' }, options);
  let { lines, mask, painted, averageSurface } = getLinesFromImage(
    image,
    options
  );

  lines = lines.filter((line) => line.rois.length > 5);
  // we should make a filter by ROI size ?

  // we keep maximum the last 3 lines
  if (lines.length > 3) {
    lines = lines.slice(lines.length - 3, lines.length);
  }
  let ocrResult = [];
  if (options.method === 'tanimoto') {
    var ocrOptions = Object.assign({}, options.fingerprintOptions, {
      maxNotFound: 411
    });
    ocrResult = doOcrOnLines(lines, fontFingerprint, ocrOptions).map(
      (r) => r.text
    );
  } else if (options.method === 'svm') {
    const images = [];
    for (let line of lines) {
      for (let roi of line.rois) {
        images.push(
          image.crop({
            x: roi.minX,
            y: roi.minY,
            width: roi.width,
            height: roi.height
          })
        );
      }
    }

    let predicted = await predictImages(images, 'ESC-v2');
    predicted = predicted.map((p) => String.fromCharCode(p));
    let count = 0;
    for (let line of lines) {
      let lineText = '';
      for (let i = 0; i < line.rois.length; i++) {
        lineText += predicted[count++];
      }
      ocrResult.push(lineText);
    }
  } else {
    throw new Error('invalid MRZ OCR method');
  }

  return {
    ocrResult,
    mask,
    painted,
    averageSurface
  };
}

module.exports = mrzOcr;
