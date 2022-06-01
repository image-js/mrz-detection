'use strict';

const kmeans = require('ml-kmeans');

const variablesForClust = ['height'];
// if you want to add a new ambiguity to solver just add a new string to the array to be analysed
const IS_LETTER = {
  0: 'O'
};

const IS_NUMBER = {
  O: '0'
};

function ambiguitySolver(report) {
  var positions = new Array(report.length);
  var dataset = [];
  for (let i = 0; i < report.length; ++i) {
    positions[i] = [];
    var text = report[i].text;
    for (let j = 0; j < text.length; ++j) {
      var letter = text[j];
      const datasetElement = [];
      if (letter === '<') {
        continue;
      }

      variablesForClust.forEach((elem) =>
        datasetElement.push(report[i].rois[j][elem])
      );
      dataset.push(datasetElement);
    }
  }

  var { centroids, clusters } = kmeans(dataset, 2);

  var isNumber = centroids[0].centroid[0] < centroids[1].centroid[0] ? 1 : 0;
  var k = 0;
  for (let i = 0; i < report.length; ++i) {
    text = report[i].text;
    var toReplace = '';
    for (let j = 0; j < text.length; ++j) {
      letter = text[j];
      if (letter === '<') {
        toReplace += letter;
        continue;
      }

      var prediction = clusters[k];
      k++;
      var replace =
        isNumber === prediction ? IS_NUMBER[letter] : IS_LETTER[letter];
      toReplace += replace !== undefined ? replace : letter;
    }
    report[i].text = toReplace;
  }

  return report;
}

module.exports = ambiguitySolver;
