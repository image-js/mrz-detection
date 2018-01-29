'use strict';

require('make-promises-safe');
const { resolve, join } = require('path');

const testMRZ = require('./fullMRZDetection');

const dataPath = process.argv[2];

if (!dataPath) throw new Error('Call this like: node main.js path/to/data');

const rootDir = resolve(dataPath);
const paths = {
  rootDir: rootDir,
  saveMask: join(rootDir, 'data', 'mask'),
  saveMRZ: join(rootDir, 'data', 'mrz'),
  saveHTMLFile: join(rootDir, 'data', 'index.html')
};

testMRZ(paths);
