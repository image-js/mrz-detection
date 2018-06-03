// Runs a cross validation leaving all characters from an identity card out
'use strict';

const path = require('path');

const groupBy = require('lodash.groupby');
const uniq = require('lodash.uniq');
const minimist = require('minimist');
const paramGrid = require('ml-param-grid');

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

  const { classifier, descriptors, oneClass } = await train(
    trainSet,
    options.SVMOptions
  );
  let prediction = predict(
    classifier,
    descriptors,
    testSet.map((l) => l.descriptor)
  );
  if (oneClass) {
    printPredictionOneClass(testSet, prediction);
  } else {
    prediction = prediction.map((code) => String.fromCharCode(code));
    printPrediction(testSet, prediction);
  }
  classifier.free();
}

function printPrediction(letters, predicted) {
  const expected = letters.map((l) => l.char);
  error(predicted, expected);
}

function printPredictionOneClass(testSet, predicted) {
  const expected = testSet.map((l) => l.label);
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

async function crossValidation(data, SVMOptions) {
  console.log('total data size', data.length);

  // get distinct data sets

  const cards = new Set();
  data.forEach((d) => cards.add(d.card));
  for (let card of cards) {
    console.log(card);
    // eslint-disable-next-line no-await-in-loop
    await classify(data, {
      testCard: card,
      SVMOptions
    });
  }
}

async function exec() {
  try {
    validateArguments(argv);
    if (argv.cv) {
      const data = await loadData(argv.trainDir);
      const SVMOptionsGrid = getSVMOptionsGrid(argv);
      for (let SVMOptions of SVMOptionsGrid) {
        await crossValidation(data, SVMOptions);
      }
    } else if (argv.saveModel) {
      const data = await loadData(argv.trainDir);
      await createModel(data, argv.saveModel);
    } else if (argv.model) {
      const data = await loadData(argv.testDir);
      let predicted = await applyModel(argv.model, data.map((l) => l.descriptor));
      const type = inferPredictionType(predicted);
      if (type === 'ONE_CLASS') {
        printPredictionOneClass(data, predicted);
      } else {
        predicted = predicted.map((p) => String.fromCharCode(p));
        printPrediction(data, predicted);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function inferPredictionType(predicted) {
  const uniqLabels = uniq(predicted);
  if (
    uniqLabels.length > 2 ||
    (!uniqLabels.includes(1) && !uniqLabels.includes(-1))
  ) {
    return 'MULTI_CLASS';
  } else {
    return 'ONE_CLASS';
  }
}

function getSVMOptionsGrid(options) {
  const validOptions = ['nu', 'cost', 'gamma', 'kernel', 'epsilon'];
  const optionRanges = {};
  for (let option of validOptions) {
    if (options[option]) {
      optionRanges[option] = String(options[option])
        .split(',')
        .map((val) => (isNaN(+val) ? val : +val));
    }
  }
  optionRanges.quiet = true;
  return paramGrid(optionRanges);
}

function validateArguments(args) {
  if (args.trainDir === undefined && args.model === undefined) {
    throw new Error('--trainDir is mandatory except when using --model');
  }

  {
    const count =
      isDefined(args.testDir) + isDefined(args.saveModel) + isDefined(args.cv);
    if (count === 0) {
      throw new Error(
        'You must specify one of the following options: --testDir, --saveModel, --cv'
      );
    }
    if (count > 1) {
      throw new Error(
        '--testDir, --saveModel, --cv cannot be specified together'
      );
    }
  }
}

function isDefined(option) {
  if (option === undefined) return 0;
  return 1;
}

exec();
