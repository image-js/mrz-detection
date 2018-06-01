'use strict';

const groupBy = require('lodash.groupby');
const mapValues = require('lodash.mapvalues');
const percentile = require('percentile');
const SVMPromise = Promise.resolve(require('libsvm-js/wasm'));

const { loadData, applyModel } = require('../src/svm');

function getCharHeightRatioDescriptor(images) {
  const heights = images.map((img) => img.height);
  return percentile(10, heights) / percentile(90, heights);
}

async function exec() {
  //   const SVM = await SVMPromise;
  //   const SVMOptions = {};
  //   const svm = new SVM(SVMOptions);

  const dirA = './data/esc-v2-all';
  const dirB = './data/esc-v2-bidif';

  const dataA = await loadData(dirA);
  const dataB = await loadData(dirB);

  const cardsA = groupBy(dataA, (data) => data.card);
  const cardsB = groupBy(dataB, (data) => data.card);

  const featuresA = await getFeatures(cardsA);
  const featuresB = await getFeatures(cardsB);

  //   const featuresB = mapValues(cardsB, (card) =>
  //     getCharHeightRatioDescriptor(card.map((c) => c.image))
  //   );
  console.log(featuresA);
  console.log(featuresB);
}

async function getFeatures(cards) {
  const features = [];
  for (let cardKey in cards) {
    console.log(cardKey);
    let card = cards[cardKey];
    const Xtest = card.map((d) => d.descriptor);
    const pred = await applyModel('ESC-v2', Xtest);
    // console.log('length bef', card.length);
    // Filter < char for they can be smaller in some fonts
    card = card.filter((c, idx) => pred[idx] !== 60);
    // console.log('length anfter', card.length);
    console.log(card.map((c) => c.image.height));
    features.push([getCharHeightRatioDescriptor(card.map((c) => c.image))]);
  }
  return features;
}

exec()
  .then(console.log)
  .catch(console.log);
