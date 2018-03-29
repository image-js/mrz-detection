'use strict';

const path = require('path');
const assert = require('assert');

const fs = require('fs-extra');
const { generateSymbolImage, getLinesFromImage } = require('ocr-tools');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['fontSizes', 'dilations']
});
const roiOptions = require('../src/roiOptions');
const { writeImages } = require('../src/util/readWrite');

if (!argv.outDir) {
  throw new Error('outDir argument is required');
}

let outDir = path.resolve(argv.outDir);
let dilations = [0];
let fontSizes = [78];
let maxRotation = 2;
let rotations = 3;
let fonts = ['ocrb'];
if (argv.fontSizes) {
  fontSizes = argv.fontSizes.split(',').map((f) => +f);
}

if (argv.dilations) {
  dilations = argv.dilations.split(',').map((d) => +d);
}

if (argv.fonts) {
  fonts = argv.fonts.split(',');
}
async function generate() {
  await fs.mkdirp(outDir);
  const files = await fs.readdir(outDir);
  if (files.length > 0) throw new Error('outDir must be emtpy');

  let globalCount = 0;
  // grid over parameters
  for (let kernelSize of dilations) {
    for (let fontSize of fontSizes) {
      // eslint-disable-next-line no-await-in-loop
      for (let font of fonts) {
        const imageOptions = {
          allowedRotation: maxRotation,
          numberPerLine: rotations + (rotations + 1) % 2, // odd number to ensure 0 angle included
          fontSize,
          fontName: font
        };
        let { image, chars } = await generateSymbolImage(imageOptions);
        const { lines } = getLinesFromImage(image, {
          roiOptions: Object.assign({}, roiOptions, {
            minRatio: undefined,
            maxRatio: undefined
          }),
          fingerprintOptions: {
            width: 18,
            height: 18
          }
        });
        checkExpectedRois(lines, imageOptions);
        let count = 0;
        for (let line of lines) {
          // eslint-disable-next-line no-await-in-loop
          for (let roi of line.rois) {
            const borderSize = (kernelSize - 1) / 2;
            let img = image
              .crop({
                x: roi.minX,
                y: roi.minY,
                width: roi.width,
                height: roi.height
              })
              .grey();

            let mask;
            let roiManager;
            if (kernelSize) {
              img = img
                .pad({ size: borderSize, algorithm: 'set', color: [255] })
                .dilate({ kernel: getKernel(kernelSize) });
              mask = img.mask({ threshold: 0.99 });

              roiManager = img.getRoiManager();
              roiManager.fromMask(mask);
              let rois = roiManager.getRois().filter((roi) => roi.minX > 0);
              rois.forEach((roi) => {
                let mask = roi.getMask();
                let mbr = mask.minimalBoundingRectangle();
                roi.mbrWidth = getDistance(mbr[0], mbr[1]);
                roi.mbrHeight = getDistance(mbr[1], mbr[2]);
                roi.mbrSurface = roi.mbrWidth * roi.mbrHeight;
                roi.fillingFactor = roi.surface / roi.mbrSurface;
              });

              rois.sort(
                (roiA, roiB) => roiA.fillingFactor - roiB.fillingFactor
              );
              img = img.crop({
                x: rois[0].minX,
                y: rois[0].minY,
                width: rois[0].width,
                height: rois[0].height
              });
            }

            img = img.scale({ width: 18, height: 18 });

            await writeImages({
              filePath: path.join(outDir, `${chars[count]}-${globalCount}.png`),
              image: img /*roiManager.paint()*/,
              generated: true,
              char: chars[count],
              code: chars[count].charCodeAt(0)
            });
            globalCount++;
            count++;
          }
        }
      }
    }
  }
}

function checkExpectedRois(lines, options) {
  assert.equal(lines.length, 37, 'correct number of lines');
  const nbRois = lines.reduce((prev, current) => prev + current.rois.length, 0);
  assert.equal(nbRois, options.numberPerLine * 37);
}

generate();

function getKernel(size) {
  const array = new Array(size);
  for (let i = 0; i < size; i++) {
    array[i] = new Array(size);
    for (let j = 0; j < size; j++) {
      array[i][j] = 1;
    }
  }
  return array;
}

function getDistance(p1, p2) {
  return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}
