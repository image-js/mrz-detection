'use strict';

const path = require('path');
const assert = require('assert');

const fs = require('fs-extra');
const { generateSymbolImage, getLinesFromImage } = require('ocr-tools');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));
const roiOptions = require('../src/roiOptions');
const { writeImages } = require('../src/util/readWrite');

if (!argv.outDir) {
  throw new Error('outDir argument is required');
}

let outDir = path.resolve(argv.outDir);
let fontSizes = [48];
let maxRotation = 2;
let rotations = 5;
let fonts = ['ocrb'];
if (argv.fontSizes) {
  fontSizes = argv.fontSizes.split(',').map((f) => +f);
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
  for (let fontSize of fontSizes) {
    // eslint-disable-next-line no-await-in-loop
    for (let font of fonts) {
      console.log(font, fontSize);
      const imageOptions = {
        allowedRotation: maxRotation,
        numberPerLine: rotations + (rotations + 1) % 2, // odd number to ensure 0 angle included
        fontSize,
        fontName: font
      };
      const { image, chars } = await generateSymbolImage(imageOptions);
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
          const img = image.crop({
            x: roi.minX,
            y: roi.minY,
            width: roi.width,
            height: roi.height
          });
          await writeImages({
            filePath: path.join(outDir, `${chars[count]}-${globalCount}.png`),
            image: img,
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

function checkExpectedRois(lines, options) {
  assert.equal(lines.length, 37, 'correct number of lines');
  const nbRois = lines.reduce((prev, current) => prev + current.rois.length, 0);
  console.log(nbRois);
  assert.equal(nbRois, options.numberPerLine * 37);
}

generate();
