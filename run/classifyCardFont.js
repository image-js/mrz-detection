'use strict';

const groupBy = require('lodash.groupby');
const minimist = require('minimist');

const { loadData } = require('../src/svm');
const { getNumberToLetterHeightRatio } = require('../src/util/rois');

const argv = minimist(process.argv.slice(2));

async function exec() {
  const dir = argv.dir;
  if (!dir) throw new Error('--dir option is required');

  const data = await loadData(dir);

  const cards = groupBy(data, (data) => data.card);

  const features = getFeatures(cards);

  console.log(features);
}

function getFeatures(cards) {
  const features = [];
  for (let cardKey in cards) {
    const ratio = getNumberToLetterHeightRatio(cards[cardKey]);
    console.log(cardKey, ratio);
    features.push(ratio);
  }
  return features;
}

exec().catch(console.log);
