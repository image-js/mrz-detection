'use strict';
const fs = require('fs-extra');
const path = require('path');
const hog = require('hog-features');
const SVMPromise = Promise.resolve(require('libsvm-js/asm'));
const Kernel = require('ml-kernel');
const range = require('lodash.range');
const BSON = require('bson');

const kernel = new Kernel('linear');

let SVM;

function extractHOG(image) {
  image = image.scale({ width: 18, height: 18 });

  let optionsHog = {
    cellSize: 4,
    blockSize: 1,
    blockStride: 1,
    bins: 4,
    norm: 'L2'
  };
  return hog.extractHOG(image, optionsHog);
}

// Get descriptors for images from 1 identity card
function getDescriptors(images) {
  const result = [];
  for (let image of images) {
    result.push(extractHOG(image));
  }

  const heights = images.map((img) => img.height);
  const maxHeight = Math.max.apply(null, heights);
  const minHeight = Math.min.apply(null, heights);
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let bonusFeature = 1;
    if (minHeight !== maxHeight) {
      bonusFeature = (img.height - minHeight) / (maxHeight - minHeight);
    }
    result[i].push(bonusFeature);
  }
  return result;
}

function predictImages(images, modelName) {
  const Xtest = getDescriptors(images);
  return applyModel(modelName, Xtest);
}

async function applyModel(name, Xtest) {
  await loadSVM();
  const { descriptors: descriptorsPath, model: modelPath } = getFilePath(name);
  const bson = new BSON();
  const Xtrain = bson.deserialize(await fs.readFile(descriptorsPath))
    .descriptors;
  const model = await fs.readFile(modelPath, 'utf-8');
  const classifier = SVM.load(model);
  const prediction = predict(classifier, Xtrain, Xtest);
  return prediction;
}

async function createModel(letters, name) {
  const { descriptors: descriptorsPath, model: modelPath } = getFilePath(name);
  const { descriptors, classifier } = await train(letters);
  const bson = new BSON();
  await fs.writeFile(descriptorsPath, bson.serialize({ descriptors }));
  await fs.writeFile(modelPath, classifier.serializeModel());
}

function predict(classifier, Xtrain, Xtest) {
  const Ktest = kernel
    .compute(Xtest, Xtrain)
    .addColumn(0, range(1, Xtest.length + 1));
  const result = classifier.predict(Ktest);
  return result.map((p) => String.fromCharCode(p));
}

async function train(letters) {
  await loadSVM();
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

function getFilePath(name) {
  const dataDir = path.join(__dirname, '../models');
  const fileBase = path.join(dataDir, name);
  return {
    descriptors: `${fileBase}.svm.descriptors`,
    model: `${fileBase}.svm.model`
  };
}

async function loadSVM() {
  SVM = await SVMPromise;
}

module.exports = {
  applyModel,
  createModel,
  train,
  predict,
  extractHOG,
  predictImages
};
