'use strict';

const { join, resolve, extname, parse: parsePath } = require('path');
const { getLinesFromImage } = require('ocr-tools');
const fs = require('fs-extra');
const minimist = require('minimist');
const IJS = require('image-js').Image;

const argv = minimist(process.argv.slice(2));

exec().catch(console.error);

async function exec() {
  const expected = await getExpected();

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
    try {
      const parsedPath = parsePath(imagePath);
      const image = await IJS.load(imagePath);
      const result = getLinesFromImage(image, {
        roiOptions: {
          positive: true,
          negative: false,
          minSurface: 40,
          minRatio: 0.3,
          maxRatio: 3.0,
          algorithm: 'otsu',
          randomColors: true
        },
        fingerprintOptions: {}
      });

      const name = parsedPath.base.replace(parsedPath.ext, '');
      if (matchesExpected(name, result.lines)) {
        for (let i = 0; i < result.lines.length; i++) {
          const line = result.lines[i];
          for (let j = 0; j < line.rois.length; j++) {
            const roi = line.rois[j];
            const folder = join('data/characters', expected[name][i][j]);
            const fileName = `${name}-${i}-${j}.png`;
            fs.mkdirpSync(folder);
            const img = image.crop({
              x: roi.minX,
              y: roi.minY,
              width: roi.width,
              height: roi.height
            });
            await img.save(join(folder, fileName));
          }
        }
      }
    } catch (e) {
      console.log('error', e);
    }
  }

  function matchesExpected(name, lines) {
    console.log(name);
    if (lines.length !== expected[name].length) return false;
    for (let i = 0; i < lines.length; i++) {
      const x = expected[name][i];
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
