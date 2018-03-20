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

let optionsHog = {
  cellSize: 4,
  blockSize: 2,
  blockStride: 1,
  bins: 4,
  norm: 'L2'
};
let SVM;
async function loadData() {
  SVM = await SVMPromise;
  const dir = path.join(__dirname, '../data/characters');
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

function classify(data, options) {
  let SVMOptions = {
    type: SVM.SVM_TYPES.C_SVC,
    kernel: SVM.KERNEL_TYPES.PRECOMPUTED,
    quiet: true
  };
  console.log(('test set: ', options.testName));
  const testSet = data.filter((d) => d.name === options.testName);
  const trainSet = data.filter((d) => d.name !== options.testName);

  const Xtrain = trainSet.map((s) => s.descriptor);
  const Ytrain = trainSet.map((s) => s.charCode);
  const Xtest = testSet.map((s) => s.descriptor);
  const Ytest = testSet.map((s) => s.charCode);

  var classifier = new SVM(SVMOptions);

  const kernel = new Kernel('linear');
  const KData = kernel
    .compute(Xtrain)
    .addColumn(0, range(1, Ytrain.length + 1));
  const Ktest = kernel
    .compute(Xtest, Xtrain)
    .addColumn(0, range(1, Xtest.length + 1));

  classifier.train(KData, Ytrain);
  const model = classifier.serializeModel();
  const result = classifier.predict(Ktest);
  const testSetLength = Xtest.length;
  const predictionError = error(result, Ytest);
  const accuracy =
    (parseFloat(testSetLength) - parseFloat(predictionError)) /
    parseFloat(testSetLength) *
    100;
  console.log(`Test Set Size = ${testSetLength} and accuracy ${accuracy}%`);
  return { model, kernel: KData };
}

function error(predicted, expected) {
  let misclassifications = 0;
  for (var index = 0; index < predicted.length; index++) {
    if (expected[index] !== predicted[index]) {
      console.log(
        `${index} => expected : ${String.fromCharCode(
          expected[index]
        )} and predicted : ${String.fromCharCode(predicted[index])}`
      );
    }
    if (parseInt(predicted[index]) !== parseInt(expected[index])) {
      misclassifications++;
    }
  }
  return misclassifications;
}

async function exec() {
  const data = await loadData();
  console.log('total data size', data.length);

  // get distinct data sets

  const names = new Set();
  data.forEach((d) => names.add(d.name));
  //eslint-disable-next-line no-await-in-loop
  for (let name of names) {
    const { model, kernel } = classify(data, {
      testName: name
    });

    // Save model and kernel
    await fs.writeFile('svm.model', model);
    await fs.writeFile('data.kernel', JSON.stringify(kernel));
  }
}

exec();
