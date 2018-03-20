// Runs a cross validation leaving all characters from an identity card out
'use strict';

const fs = require('fs-extra');
const path = require('path');
const IJS = require('image-js').Image;
const hog = require('hog-features');
const SVMPromise = require('libsvm-js/wasm');
const Kernel = require('ml-kernel');
const range = require('lodash.range');
const groupBy = require('lodash.groupby');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));
const kernel = new Kernel('linear');

let optionsHog = {
  cellSize: 4,
  blockSize: 2,
  blockStride: 1,
  bins: 4,
  norm: 'L2'
};

let SVM;
function train(letters) {
  let SVMOptions = {
    type: SVM.SVM_TYPES.C_SVC,
    kernel: SVM.KERNEL_TYPES.PRECOMPUTED,
    quiet: true
  };

  const Xtrain = letters.map((s) => s.descriptor);
  const Ytrain = letters.map((s) => s.charCode);

  var classifier = new SVM(SVMOptions);

  const KData = kernel
    .compute(Xtrain)
    .addColumn(0, range(1, Ytrain.length + 1));
  classifier.train(KData, Ytrain);
  return { classifier, descriptors: Xtrain };
}

function getFilePath(dir, name) {
  const dataDir = path.join(__dirname, '../data');
  const fileBase = path.join(dataDir, name);
  return {
    descriptors: `${fileBase}.svm.descriptors`,
    model: `${fileBase}.svm.model`
  };
}

async function createModel(dir, name) {
  const { descriptors: descriptorsPath, model: modelPath } = getFilePath(
    dir,
    name
  );
  const letters = await loadData(dir);
  const { descriptors, classifier } = train(letters);
  await fs.writeFile(descriptorsPath, JSON.stringify(descriptors));
  await fs.writeFile(modelPath, classifier.serializeModel());
}

async function applyModel(dir, name) {
  const { descriptors: descriptorsPath, model: modelPath } = getFilePath(
    dir,
    name
  );
  const descriptors = JSON.parse(await fs.readFile(descriptorsPath, 'utf-8'));
  const model = await fs.readFile(modelPath, 'utf-8');
  const letters = await loadData(dir);
  const classifier = SVM.load(model);
  const prediction = predict(classifier, descriptors, letters);
  printPrediction(letters, prediction);
}

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
      image = image.scale({ width: 28, height: 28 });
      var descriptor = hog.extractHOG(image, optionsHog);
      //   var descriptor = Array.from(image.data);
      const m = /(\d+-.+)-(\d+)-(\d+)/.exec(file);
      const element = {
        name: m[1],
        linePosition: +m[2],
        charPosition: +m[3],
        image,
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
    const maxHeight = Math.max.apply(
      null,
      groupedData[name].map((d) => d.height)
    );
    const minHeight = Math.min.apply(
      null,
      groupedData[name].map((d) => d.height)
    );
    for (let d of groupedData[name]) {
      // This last descriptor is very important to differentiate numbers and letters
      // Because with OCR-B font, numbers are slightly higher than numbers
      if (minHeight === maxHeight) d.descriptor.push(1);
      else d.descriptor.push((d.height - minHeight) / (maxHeight - minHeight));
    }
  }
  return data;
}

function predict(classifier, Xtrain, letters) {
  const Xtest = letters.map((l) => l.descriptor);
  const Ktest = kernel
    .compute(Xtest, Xtrain)
    .addColumn(0, range(1, Xtest.length + 1));
  const result = classifier.predict(Ktest);
  return result;
}

function classify(data, options) {
  console.log(('test set: ', options.testName));
  const testSet = data.filter((d) => d.name === options.testName);
  const trainSet = data.filter((d) => d.name !== options.testName);

  const { classifier, descriptors } = train(trainSet);
  const prediction = predict(classifier, descriptors, testSet);
  printPrediction(testSet, prediction);
}

function printPrediction(letters, predicted) {
  const expected = letters.map((l) => l.charCode);
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
        `${index} => expected : ${String.fromCharCode(
          expected[index]
        )} and predicted : ${String.fromCharCode(predicted[index])}`
      );
    }
    if (parseInt(predicted[index]) === parseInt(expected[index])) {
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

async function crossValidation(dir) {
  const data = await loadData(dir);
  console.log('total data size', data.length);

  // get distinct data sets

  const names = new Set();
  data.forEach((d) => names.add(d.name));
  //eslint-disable-next-line no-await-in-loop
  for (let name of names) {
    classify(data, {
      testName: name
    });
  }
}

async function exec() {
  SVM = await SVMPromise;
  if (!argv.dir) {
    throw new Error('dir argument is mandatory');
  }
  if (argv.cv) {
    crossValidation(argv.dir);
  } else if (argv.saveModel || argv.applyModel) {
    if (!argv.modelName) {
      throw new Error('model name required');
    }
    if (argv.saveModel) {
      createModel(argv.dir, argv.modelName);
    } else {
      applyModel(argv.dir, argv.modelName);
    }
  }
}

exec();
