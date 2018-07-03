'use strict';
const ENVIRONMENT_IS_WEB = typeof window === 'object';
const ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';

const path = require('path');

// babelify will generate distinct names if we define
// the same constants both in "if" and "else" blocks
// Variables are fine for me...
var fs;
var SVMPromise;

if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  const request = require('request-promise');
  fs = {
    readFile: function (url, encoding) {
      var dirname = __dirname.split('/');
      dirname.pop();
      url = url.replace(dirname.join('/'), '');
      return request({
        /* global self */
        /* global location */
        /* eslint no-undef: "error" */
        url: ((self && self.config && self.config.fsRootUrl) ? `${self.config.fsRootUrl}/${url}` : `${location.origin}/${url}`),
        encoding: null,
        resolveWithFullResponse: false
      })
        .then(function (body) {
          var buf = Buffer.from(body);
          return (encoding) ? buf.toString(encoding) : buf;
        });
    },
    writeFile: function () {
      throw new Error('writeFile not implemented');
    }
  };
  SVMPromise = Promise.resolve(require('libsvm-js/asm'));
} else {
  // use a variable for the module name so that browserify does not include it
  var _module = 'fs-extra';
  fs = require(_module);
  _module = 'libsvm-js/wasm';
  SVMPromise = Promise.resolve(require(_module));
}

const hog = require('hog-features');
const Kernel = require('ml-kernel');
const range = require('lodash.range');
const uniq = require('lodash.uniq');
const BSON = require('bson');

let SVM;
function extractHOG(image) {
  image = image.scale({ width: 20, height: 20 });
  image = image.pad({
    size: 2
  });
  let optionsHog = {
    cellSize: 5,
    blockSize: 2,
    blockStride: 1,
    bins: 4,
    norm: 'L2'
  };
  let hogFeatures = hog.extractHOG(image, optionsHog);
  return hogFeatures;
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
  const { descriptors: Xtrain, kernelOptions } = bson.deserialize(
    await fs.readFile(descriptorsPath)
  );

  const model = await fs.readFile(modelPath, 'utf-8');
  const classifier = SVM.load(model);
  const prediction = predict(classifier, Xtrain, Xtest, kernelOptions);
  return prediction;
}

async function createModel(letters, name, SVMOptions, kernelOptions) {
  const { descriptors: descriptorsPath, model: modelPath } = getFilePath(name);
  const { descriptors, classifier } = await train(
    letters,
    SVMOptions,
    kernelOptions
  );
  const bson = new BSON();
  await fs.writeFile(
    descriptorsPath,
    bson.serialize({ descriptors, kernelOptions })
  );
  await fs.writeFile(modelPath, classifier.serializeModel());
}

function predict(classifier, Xtrain, Xtest, kernelOptions) {
  const kernel = getKernel(kernelOptions);
  const Ktest = kernel
    .compute(Xtest, Xtrain)
    .addColumn(0, range(1, Xtest.length + 1));
  return classifier.predict(Ktest);
}

async function train(letters, SVMOptions, kernelOptions) {
  await loadSVM();
  let SVMOptionsOneClass = {
    type: SVM.SVM_TYPES.ONE_CLASS,
    kernel: SVM.KERNEL_TYPES.PRECOMPUTED,
    // cost: 0.1,
    nu: 0.5,
    // gamma: 0.1,
    quiet: true
  };

  let SVMNormalOptions = {
    type: SVM.SVM_TYPES.C_SVC,
    kernel: SVM.KERNEL_TYPES.PRECOMPUTED,
    gamma: 1,
    quiet: true
  };

  const Xtrain = letters.map((s) => s.descriptor);
  const Ytrain = letters.map((s) => s.label);

  const uniqLabels = uniq(Ytrain);
  if (uniqLabels.length === 1) {
    // eslint-disable-next-line no-console
    console.log('training mode: ONE_CLASS');
    SVMOptions = Object.assign({}, SVMOptionsOneClass, SVMOptions, {
      kernel: SVM.KERNEL_TYPES.PRECOMPUTED
    });
  } else {
    SVMOptions = Object.assign({}, SVMNormalOptions, SVMOptions, {
      kernel: SVM.KERNEL_TYPES.PRECOMPUTED
    });
  }

  let oneClass = SVMOptions.type === SVM.SVM_TYPES.ONE_CLASS;

  var classifier = new SVM(SVMOptions);
  let kernel = getKernel(kernelOptions);

  const KData = kernel
    .compute(Xtrain)
    .addColumn(0, range(1, Ytrain.length + 1));
  classifier.train(KData, Ytrain);
  return { classifier, descriptors: Xtrain, oneClass };
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

function getKernel(options) {
  options = Object.assign({ type: 'linear' }, options);
  return new Kernel(options.type, options);
}

module.exports = {
  applyModel,
  createModel,
  train,
  predict,
  extractHOG,
  predictImages
};
