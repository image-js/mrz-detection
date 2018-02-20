'use strict';

const { join, resolve, extname } = require('path');

const fs = require('fs-extra');
const minimist = require('minimist');
const IJS = require('image-js').Image;
const { parse } = require('mrz');

const { readMrz } = require('..');

const argv = minimist(process.argv.slice(2));

exec().catch(console.error);

async function exec() {
  if (argv.file) {
    const pathname = resolve(argv.file);
    const result = await readMrz(await IJS.load(pathname), {
      debug: true
    });
    console.log(result);
  } else if (argv.dir) {
    const dirname = resolve(argv.dir);
    const files = (await fs.readdir(dirname)).filter((f) => {
      f = f.toLowerCase();
      return f.endsWith('jpg') || f.endsWith('png') || f.endsWith('jpeg');
    });
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
          expected[name] = mrz;
        }
      } catch (e) {
        // ignore
      }
    }
    for (let file of files) {
      console.log('----------------------------------------------------------');
      console.log(`process ${file}`);
      const imagePath = join(dirname, file);
      try {
        const result = readMrz(await IJS.load(imagePath), {
          debug: true
        });
        console.log(result);
        const parsed = parse(result);
        console.log('valid', parsed.valid);
        if (!parsed.valid) {
          console.log(
            parsed.details.filter((d) => !d.valid).map((d) => d.error)
          );
        }
        const nameWithoutExt = file.replace(extname(file), '');
        if (expected[nameWithoutExt]) {
          const reference = expected[nameWithoutExt];
          if (result.length !== reference.length) {
            console.log(
              `error: expected ${reference.length} lines, got ${result.length}`
            );
          } else {
            for (let i = 0; i < result.length; i++) {
              if (result[i] !== reference[i]) {
                console.log(`line ${i + 1} does not match`);
                console.log(`expected: ${reference[i]}`);
                console.log(`got:      ${result[i]}`);
              }
            }
          }
        } else {
          console.log('no reference to compare result');
        }
      } catch (e) {
        console.log('read error');
      }
    }
  }
}
