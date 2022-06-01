'use strict';

const bestMatch = require('./bestMatch');
const ambiguitySolver = require('./ambiguitySolver');

module.exports = function doOcrOnLines(lines, fontData, options = {}) {
  var {
    minSimilarity = 0.8,
    maxNotFound = Number.MIN_SAFE_INTEGER,
    ambiguity = false
  } = options;

  // we try to analyse each line
  var totalSimilarity = 0;
  var totalFound = 0;
  var totalNotFound = 0;
  for (var line of lines) {
    line.text = '';
    line.similarity = 0;
    line.found = 0;
    line.notFound = 0;
    var rois = line.rois;
    for (var roi of rois) {
      // TODO: get roi.mask() for matrix
      var roiData = roi.data;
      var match = bestMatch(roiData, fontData);
      if (match.similarity > minSimilarity) {
        line.text += match.symbol;
        line.similarity += match.similarity;
        line.found++;
      } else {
        line.text += '?';
        line.notFound++;
      }
    }
    totalSimilarity += line.similarity;
    totalFound += line.found;
    totalNotFound += line.notFound;
  }

  const report = [];
  for (const line of lines) {
    if (line.notFound < maxNotFound) {
      const rois = [];
      for (const roi of line.rois) {
        rois.push({
          meanX: roi.meanX,
          meanY: roi.meanY,
          width: roi.width,
          height: roi.height
        });
      }
      report.push({
        text: line.text,
        found: line.found,
        notFound: line.notFound,
        similarity: line.similarity,
        rois: rois
      });
    }
  }

  if (ambiguity) {
    ambiguitySolver(report);
  }

  return {
    lines: report,
    totalSimilarity,
    totalFound,
    totalNotFound
  };
};
