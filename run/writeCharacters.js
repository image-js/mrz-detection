'use strict';

const { join, resolve, extname, parse: parsePath } = require('path');

const { getLinesFromImage } = require('ocr-tools');
const fs = require('fs-extra');
const minimist = require('minimist');
const IJS = require('image-js').Image;

const { writeImages } = require('../src/util/readWrite');
const roiOptions = require('../src/roiOptions');

const argv = minimist(process.argv.slice(2));

exec().catch(console.error);

async function exec() {
  let outDir;
  const expected = await getExpected();

  if (!argv.outDir) {
    throw new Error('you must specify an output director with --outDir');
  } else {
    outDir = resolve(argv.outDir);
    await fs.mkdirp(outDir);
    const dirList = await fs.readdir(outDir);
    if (dirList.length !== 0) {
      throw new Error('The output directory must be empty');
    }
  }
  if (argv.file) {
    const pathname = resolve(argv.file);
    await processFile(pathname);
  } else if (argv.dir) {
    const dirname = resolve(argv.dir);
    const files = (await fs.readdir(dirname)).filter((f) => {
      f = f.toLowerCase();
      return f.endsWith('jpg') || f.endsWith('png') || f.endsWith('jpeg');
    });

    for (let file of files) {
      console.log(
        '----------------------------------------------------------'.repeat(2)
      );
      console.log(`process ${file}`);
      const imagePath = join(dirname, file);
      await processFile(imagePath);
    }
  }
  async function processFile(imagePath) {
    let shouldAdd = getCharacterCounter(argv.maxCount);
    try {
      const parsedPath = parsePath(imagePath);
      const image = await IJS.load(imagePath);
      const result = getLinesFromImage(image, {
        roiOptions,
        fingerprintOptions: {}
      });

      const name = parsedPath.base.replace(parsedPath.ext, '');
      const asExpected = matchesExpected(name, result.lines);
      if (asExpected) {
        console.log('looks good, write chars');
        for (let i = 0; i < result.lines.length; i++) {
          const line = result.lines[i];
          // eslint-disable-next-line no-await-in-loop
          for (let j = 0; j < line.rois.length; j++) {
            const char = asExpected ? expected[name][i][j] : '';
            if (asExpected && !shouldAdd(char)) continue;
            const roi = line.rois[j];
            const folder = join(outDir, char);
            const fileName = `${name}-${i}-${j}.png`;
            fs.mkdirpSync(folder);
            const img = image.crop({
              x: roi.minX,
              y: roi.minY,
              width: roi.width,
              height: roi.height
            });
            await writeImages({
              image: img,
              filePath: join(folder, fileName),
              generated: false,
              char,
              code: char.charCodeAt(0),
              label: argv.oneClass ? +argv.oneClass : char.charCodeAt(0),
              card: name,
              line: i,
              column: j
            });
          }
        }
      } else {
        console.log('did not pass check, not including this image');
      }
    } catch (e) {
      console.log('error', e);
    }
  }

  function getCharacterCounter(max = 4) {
    max = +max;
    const count = {};
    return function (char) {
      if (!count[char]) {
        count[char] = 1;
        return true;
      } else {
        count[char]++;
        if (count[char] > max) return false;
      }
      return true;
    };
  }

  function matchesExpected(name, lines) {
    console.log(lines.length, expected[name].length);
    if (lines.length !== expected[name].length) return false;
    for (let i = 0; i < lines.length; i++) {
      const x = expected[name][i];
      console.log(x.length, lines[i].rois.length);
      if (x.length !== lines[i].rois.length) {
        return false;
      }
    }
    return true;
  }
}

async function getExpected() {
  const expected = {};
  if (argv.reference) {
    try {
      const reference = await fs.readFile(resolve(argv.reference), 'utf8');
      const lines = reference
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l !== '');
      for (const line of lines) {
        const [name, ...mrz] = line.split(',');
        expected[name.replace(extname(name), '')] = mrz;
      }
    } catch (e) {
      console.log('error', e.message);
      // error
    }
  }
  return expected;
}
