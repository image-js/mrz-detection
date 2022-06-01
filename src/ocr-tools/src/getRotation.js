'use strict';

const runOCR = require('./runOCR');

module.exports = function getRotation(image, fontFingerprint, options = {}) {
  var similarities = [];
  var result = runOCR(image, fontFingerprint, options);
  similarities.push({
    rotation: 0,
    similarity: result.totalSimilarity
  });
  for (var rotation = 90; rotation < 360; rotation += 90) {
    var rotated = image.rotate(rotation);
    result = runOCR(rotated, fontFingerprint, options);
    similarities.push({
      rotation: rotation,
      similarity: result.totalSimilarity
    });
  }
  similarities.sort(function (a, b) {
    return b.similarity - a.similarity;
  });
  return {
    rotation: similarities[0].rotation,
    reliability:
      (similarities[0].similarity - similarities[1].similarity) /
      similarities[0].similarity *
      100,
    similarities
  };
};
