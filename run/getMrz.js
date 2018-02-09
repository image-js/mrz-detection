'use strict';

const path = require('path');
const fs = require('fs-extra');
const minimist = require('minimist');
const IJS = require('image-js').Image;

const { getMrz } = require('..');

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
    await saveImages(
      pathname,
      result.images,
      path.join(path.dirname(pathname), 'out')
    );
  } else if (argv.dir) {
    const dirname = path.resolve(argv.dir);
    const files = (await fs.readdir(dirname)).filter((f) => {
      f = f.toLowerCase();
      return f.endsWith('jpg') || f.endsWith('png') || f.endsWith('jpeg');
    });
    const out = path.join(dirname, 'out');
    await fs.emptyDir(out);
    for (let file of files) {
      console.log(`process ${file}`);
      const imagePath = path.join(dirname, file);
      console.time(imagePath);
      const result = getMrz(await IJS.load(imagePath), {
        debug: true
      });
      console.timeEnd(imagePath);
      await saveImages(imagePath, result.images, out);
    }
  }
}

async function saveImages(imagePath, images, out) {
  const filename = path.basename(imagePath);
  const ext = path.extname(filename);
  const pngName = filename.replace(ext, '.png');
  for (const prefix in images) {
    const kind = path.join(out, prefix);
    await fs.ensureDir(kind);
    await images[prefix].save(path.join(kind, pngName));
  }
}
