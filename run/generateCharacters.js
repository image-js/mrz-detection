'use strict';

const path = require('path');
const assert = require('assert');

const fs = require('fs-extra');
const { generateSymbolImage, getLinesFromImage } = require('ocr-tools');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['fontSizes', 'dilations', 'blurs']
});
const roiOptions = require('../src/roiOptions');
const { writeImages } = require('../src/util/readWrite');

if (!argv.outDir) {
  throw new Error('outDir argument is required');
}

let outDir = path.resolve(argv.outDir);
let blurs = getParam('blurs', [1, 2, 3]);
let fontSizes = getParam('fontSizes', [78]);
let dilations = getParam('dilations', [0]);

let maxRotation = 2;
let rotations = 3;
let fonts = getParam('fonts', ['ocrb']);

async function generate() {
  await fs.mkdirp(outDir);
  const files = await fs.readdir(outDir);
  if (files.length > 0) throw new Error('outDir must be emtpy');

  let globalCount = 0;
  // grid over parameters
  for (let blur of blurs) {
    for (let kernelSize of dilations) {
      for (let fontSize of fontSizes) {
        // eslint-disable-next-line no-await-in-loop
        for (let font of fonts) {
          console.log(`
            font: ${font}
            fontSize: ${fontSize}
            blur: ${blur}
            dilation: ${kernelSize}
        `);
          const imageOptions = {
            allowedRotation: maxRotation,
            numberPerLine: rotations + ((rotations + 1) % 2), // odd number to ensure 0 angle included
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
              let img = image
                .crop({
                  x: roi.minX,
                  y: roi.minY,
                  width: roi.width,
                  height: roi.height
                })
                .grey();

              let borderSize = (kernelSize - 1) / 2;
              borderSize = Math.max(borderSize, Math.round(blur * 1.5));
              let mask;
              let roiManager;
              img = img.pad({
                size: borderSize,
                algorithm: 'set',
                color: [255]
              });
              if (kernelSize) {
                img = img.dilate({ kernel: getKernel(kernelSize) });
              }

              if (blur) {
                img = img.gaussianFilter({ radius: blur });
              }

              mask = img.mask({ algorithm: 'otsu' });

              roiManager = img.getRoiManager();
              roiManager.fromMask(mask);
              let rois = roiManager.getRois();
              rois = rois.filter((roi) => roi.minX > 0);
              rois.forEach((roi) => {
                let mask = roi.getMask();
                let mbr = mask.minimalBoundingRectangle();
                if (mbr[0] === undefined) {
                  roi.fillingFactor = 1;
                  return;
                }
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
              // img = img.scale({ width: 18, height: 18 });

              await writeImages({
                filePath: path.join(
                  outDir,
                  `${chars[count]}-${globalCount}.png`
                ),
                image: img /* roiManager.paint() */,
                generated: true,
                card: `generated-blur${blur}-font${font}-fontSize${fontSize}-dilation${kernelSize}`,
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

function getParam(name, def) {
  const val = argv[name];
  if (!val) return def;
  return val.split(',').map((v) => +v);
}
