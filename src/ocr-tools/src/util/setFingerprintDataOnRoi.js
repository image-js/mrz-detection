'use strict';

module.exports = function (lines, options) {
  for (let line of lines) {
    for (let roi of line.rois) {
      var small = roi.getMask().scale({
        width: options.width,
        height: options.height
      });
      roi.data = Array.from(small.data);
    }
  }
};
