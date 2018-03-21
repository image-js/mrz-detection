// Runs a cross validation leaving all characters from an identity card out
'use strict';

const path = require('path');
const groupBy = require('lodash.groupby');
const minimist = require('minimist');
const {
  createModel,
  applyModel,
  predict,
  train,
  extractHOG
} = require('../src/svm');
const { readImages } = require('../src/util/readWrite');

const argv = minimist(process.argv.slice(2));

async function loadData(dir) {
  dir = path.resolve(path.join(__dirname, '..'), dir);
  const data = await readImages(dir);
  for (let entry of data) {
    let { image } = entry;
    entry.descriptor = extractHOG(image);
    entry.height = image.height;
  }

  const groupedData = groupBy(data, (d) => d.card);
  for (let card in groupedData) {
    const heights = groupedData[card].map((d) => d.height);
    const maxHeight = Math.max.apply(null, heights);
    const minHeight = Math.min.apply(null, heights);
    for (let d of groupedData[card]) {
      // This last descriptor is very important to differentiate numbers and letters
      // Because with OCR-B font, numbers are slightly higher than numbers
      let bonusFeature = 1;
      if (minHeight !== maxHeight) {
        bonusFeature = (d.height - minHeight) / (maxHeight - minHeight);
      }
      d.descriptor.push(bonusFeature);
    }
  }
  return data;
}

async function classify(data, options) {
  const testSet = data.filter((d) => d.card === options.testCard);
  const trainSet = data.filter((d) => d.card !== options.testCard);

  const { classifier, descriptors } = await train(trainSet);
  const prediction = predict(
    classifier,
    descriptors,
    testSet.map((l) => l.descriptor)
  );
  printPrediction(testSet, prediction);
}

function printPrediction(letters, predicted) {
  const expected = letters.map((l) => l.char);
  error(predicted, expected);
}

function error(predicted, expected) {
  if (predicted.length !== expected.length) {
    throw new Error('predicted and expected should have the same size');
  }
  let correct = 0;
  for (var index = 0; index < predicted.length; index++) {
    if (expected[index] !== predicted[index]) {
      console.log(
        `${index} => expected : ${expected[index]} and predicted : ${
          predicted[index]
        }`
      );
    }
    if (predicted[index] === expected[index]) {
      correct++;
    }
  }
  console.log(
    `${correct}/${predicted.length} ( ${(
      correct /
      predicted.length *
      100
    ).toFixed(2)}% )`
  );
  return correct;
}

async function crossValidation(data) {
  console.log('total data size', data.length);

  // get distinct data sets

  const cards = new Set();
  data.forEach((d) => cards.add(d.card));
  //eslint-disable-next-line no-await-in-loop
  for (let card of cards) {
    console.log(card);
    await classify(data, {
      testCard: card
    });
  }
}

async function exec() {
  if (!argv.dir) {
    throw new Error('dir argument is mandatory');
  }
  const data = await loadData(argv.dir);
  if (argv.cv) {
    await crossValidation(data);
  } else if (argv.saveModel || argv.applyModel) {
    if (!argv.modelName) {
      throw new Error('model name required');
    }
    if (argv.saveModel) {
      const data = await loadData(argv.dir);
      await createModel(data, argv.modelName);
    } else {
      const predicted = await applyModel(
        argv.modelName,
        data.map((l) => l.descriptor)
      );
      printPrediction(data, predicted);
    }
  }
}

exec();
