'use strict';

const path = require('path');
const fs = require('fs');
const minimist = require('minimist');
const IJS = require('image-js').Image;

const getMrz = require('..').getMrz;

const argv = minimist(process.argv.slice(2));

exec().catch(console.error);

async function exec() {
  if (argv.file) {
    const pathname = path.resolve(argv.file);
    console.time(pathname);
    const result = await getMrz(await IJS.load(pathname), {
      debug: true
    });
    console.timeEnd(pathname);
    await saveImages(pathname, result.images);
  } else if (argv.dir) {
    const dirname = path.resolve(argv.dir);
    const files = fs.readdirSync(dirname).filter((f) => {
      f = f.toLowerCase();
      return f.endsWith('jpg') || f.endsWith('png') || f.endsWith('jpeg');
    });
    for (let file of files) {
      console.log(`process ${file}`);
      const imagePath = path.join(dirname, file);
      console.time(imagePath);
      const result = getMrz(await IJS.load(imagePath), {
        debug: true
      });
      console.timeEnd(imagePath);
      await saveImages(imagePath, result.images);
    }
  }
}

async function saveImages(imagePath, images) {
  const filename = path.basename(imagePath);
  const dirname = path.dirname(imagePath);
  const out = path.join(dirname, 'out');
  try {
    fs.mkdirSync(out);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  const ext = path.extname(filename);
  const pngName = filename.replace(ext, '.png');
  for (const prefix in images) {
    await images[prefix].save(path.join(out, `${prefix}_${pngName}`));
  }
}
