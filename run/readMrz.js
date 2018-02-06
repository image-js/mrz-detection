'use strict';

const fs = require('fs');
const { join, resolve } = require('path');

const minimist = require('minimist');
const IJS = require('image-js').Image;
const tableify = require('tableify');

const { readMrz } = require('..');

const argv = minimist(process.argv.slice(2));

exec().catch(console.error);

async function exec() {
  if (argv.file) {
    const pathname = resolve(argv.file);
    console.time(pathname);
    const result = await readMrz(await IJS.load(pathname), {
      debug: true
    });
    console.timeEnd(pathname);
    console.log(result);
  } else if (argv.dir) {
    const dirname = resolve(argv.dir);
    const files = fs.readdirSync(dirname).filter((f) => {
      f = f.toLowerCase();
      return f.endsWith('jpg') || f.endsWith('png') || f.endsWith('jpeg');
    });
    for (let file of files) {
      console.log(`process ${file}`);
      const imagePath = join(dirname, file);
      console.time(imagePath);
      const result = readMrz(await IJS.load(imagePath), {
        debug: true
      });
      console.timeEnd(imagePath);
      console.log(result);
    }
  }
}
