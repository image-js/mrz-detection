'use strict';

const { getNumberToLetterHeightRatio } = require('./util/rois');

module.exports = function getRoiStats(rois) {
  return {
    numberToLetterHeightRatio: getNumberToLetterHeightRatio(rois)
  };
};
