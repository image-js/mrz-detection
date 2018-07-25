// Runs a cross validation leaving all characters from an identity card out
'use strict';

const uniq = require('lodash.uniq');
const minimist = require('minimist');
const paramGrid = require('ml-param-grid');

const {
  createModel,
  applyModel,
  predict,
  train,
  loadData
} = require('../src/svm');

const argv = minimist(process.argv.slice(2));

async function classify(data, options) {
  const testSet = data.filter((d) => d.card === options.testCard);
  const trainSet = data.filter((d) => d.card !== options.testCard);

  const { classifier, descriptors, oneClass } = await train(
    trainSet,
    options.SVMOptions,
    options.kernelOptions
  );
  let prediction = predict(
    classifier,
    descriptors,
    testSet.map((l) => l.descriptor),
    options.kernelOptions
  );
  if (oneClass) {
    printPredictionOneClass(testSet, prediction);
  } else {
    printPrediction(testSet, prediction);
  }
  classifier.free();
}

function printPrediction(dataSet, predicted) {
  const expected = dataSet.map((l) => {
    return String.fromCharCode(l.label);
  });
  predicted = predicted.map((code) => String.fromCharCode(code));
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
      if (!argv.summary) {
        console.log(
          `${index} => expected : ${expected[index]} and predicted : ${
            predicted[index]
          }`
        );
      }
    }
    if (predicted[index] === expected[index]) {
      correct++;
    }
  }
  console.log(
    `${correct}/${predicted.length} ( ${(
      (correct / predicted.length) *
      100
    ).toFixed(2)}% )`
  );
  return correct;
}

async function crossValidation(data, SVMOptions, kernelOptions) {
  console.log('total data size', data.length);

  // get distinct data sets

  const cards = new Set();
  data.forEach((d) => cards.add(d.card));
  for (let card of cards) {
    console.log(card);
    // eslint-disable-next-line no-await-in-loop
    await classify(data, {
      testCard: card,
      SVMOptions,
      kernelOptions
    });
  }
}

async function exec() {
  try {
    validateArguments(argv);
    if (argv.cv) {
      const data = await loadData(argv.trainDir);
      const SVMOptionsGrid = getSVMOptionsGrid(argv);
      const kernelOptionsGrid = getKernelOptionsGrid(argv);
      for (let SVMOptions of SVMOptionsGrid) {
        for (let kernelOptions of kernelOptionsGrid) {
          console.log(Object.assign({}, SVMOptions, kernelOptions));
          await crossValidation(data, SVMOptions, kernelOptions);
        }
      }
    } else if (argv.saveModel) {
      const data = await loadData(argv.trainDir);
      const SVMOptions = getSVMOptionsGrid(argv);
      const kernelOptions = getKernelOptionsGrid(argv);
      if (SVMOptions.length !== 1) {
        console.log(SVMOptions);
        throw new Error('Cannot save model with multiple SVM parameters');
      }
      if (kernelOptions.length !== 1) {
        throw new Error('Cannot save model with multiple kernel options');
      }
      await createModel(data, argv.saveModel, SVMOptions[0], kernelOptions[0]);
    } else if (argv.model) {
      const data = await loadData(argv.testDir);
      let predicted = await applyModel(argv.model, data.map((l) => l.descriptor));
      const type = inferPredictionType(predicted);
      if (type === 'ONE_CLASS') {
        printPredictionOneClass(data, predicted);
      } else {
        printPrediction(data, predicted);
      }
    } else if (argv.testDir) {
      // trainDir and testDir are specified together
      const SVMOptionsGrid = getSVMOptionsGrid(argv);
      const kernelOptionsGrid = getKernelOptionsGrid(argv);
      const trainData = await loadData(argv.trainDir);
      const testData = await loadData(argv.testDir);
      const trainDescriptors = trainData.map((l) => l.descriptor);
      const testDescriptors = testData.map((l) => l.descriptor);
      for (let SVMOptions of SVMOptionsGrid) {
        for (let kernelOptions of kernelOptionsGrid) {
          console.log(Object.assign({}, SVMOptions, kernelOptions));
          const { classifier, oneClass } = await train(
            trainData,
            SVMOptions,
            kernelOptions
          );
          const predicted = predict(
            classifier,
            trainDescriptors,
            testDescriptors,
            kernelOptions
          );
          if (oneClass) {
            printPredictionOneClass(testData, predicted);
          } else {
            printPrediction(testData, predicted);
          }
        }
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

function getOptionsGrid(options, validOptions, mapProp = {}) {
  const optionRanges = {};
  for (let option of validOptions) {
    if (options[option]) {
      optionRanges[mapProp[option] || option] = String(options[option])
        .split(',')
        .map((val) => (isNaN(+val) ? val : +val));
    }
  }
  optionRanges.quiet = true;
  return paramGrid(optionRanges);
}

function getSVMOptionsGrid(options) {
  const validOptions = ['nu', 'cost', 'epsilon'];
  return Array.from(getOptionsGrid(options, validOptions));
}

function getKernelOptionsGrid(options) {
  const validOptions = ['kernel', 'gamma'];
  return Array.from(
    getOptionsGrid(options, validOptions, {
      kernel: 'type',
      gamma: 'sigma'
    })
  );
}

function validateArguments(args) {
  if (isDefined(args.trainDir, args.model) === 0) {
    throw new Error('--trainDir is mandatory except when using --model');
  }

  {
    let count = isDefined(args.testDir, args.saveModel, args.cv);
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
    count = isDefined;
  }
}

function isDefined(...options) {
  let count = 0;
  for (let option of options) {
    if (option !== undefined) count++;
  }
  return count;
}

exec();
