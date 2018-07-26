'use strict';

const mrzOcr = require('./internal/mrzOcr');
const roiOptions = require('./roiOptions');

const fingerprintOptions = {
  width: 12,
  height: 12
};

async function readMrz(image, options = {}) {
  var { ocrResult, mask, rois } = await mrzOcr(image, {
    roiOptions,
    fingerprintOptions
  });

  if (options.saveName) {
    mask.save(options.saveName);
  }

  return { rois, mrz: ocrResult };
}

module.exports = readMrz;
