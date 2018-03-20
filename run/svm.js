// Runs a cross validation leaving all characters from an identity card out
'use strict';

const fs = require('fs-extra');
const path = require('path');
const IJS = require('image-js').Image;
const groupBy = require('lodash.groupby');
const minimist = require('minimist');
const {
  createModel,
  applyModel,
  predict,
  train,
  extractHOG
} = require('../src/svm');

const argv = minimist(process.argv.slice(2));

async function loadData(dir) {
  dir = path.resolve(path.join(__dirname, '..'), dir);
  const letters = await fs.readdir(dir);
  const data = [];
  // eslint-disable-next-line no-await-in-loop
  for (let letter of letters) {
    const files = await fs.readdir(path.join(dir, letter));
    // eslint-disable-next-line no-await-in-loop
    for (let file of files) {
      const filepath = path.join(dir, letter, file);
      let image = await IJS.load(filepath);
      const height = image.height;
      const descriptor = extractHOG(image);
      const m = /(\d+-.+)-(\d+)-(\d+)/.exec(file);
      const element = {
        name: m[1],
        linePosition: +m[2],
        charPosition: +m[3],
        char: letter,
        charCode: letter.charCodeAt(0),
        descriptor,
        height
      };
      data.push(element);
    }
  }
  const groupedData = groupBy(data, (d) => d.name);
  for (let name in groupedData) {
    const heights = groupedData[name].map((d) => d.height);
    const maxHeight = Math.max.apply(null, heights);
    const minHeight = Math.min.apply(null, heights);
    for (let d of groupedData[name]) {
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
  console.log(('test set: ', options.testName));
  const testSet = data.filter((d) => d.name === options.testName);
  const trainSet = data.filter((d) => d.name !== options.testName);

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

  const names = new Set();
  data.forEach((d) => names.add(d.name));
  //eslint-disable-next-line no-await-in-loop
  for (let name of names) {
    await classify(data, {
      testName: name
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
