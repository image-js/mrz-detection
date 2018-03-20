'use strict';

const { join, resolve, extname, parse: parsePath } = require('path');

const fs = require('fs-extra');
const minimist = require('minimist');
const IJS = require('image-js').Image;
const { parse } = require('mrz');

const { readMrz } = require('..');

const argv = minimist(process.argv.slice(2));

exec().catch(console.error);

const stats = {
  total: 0,
  valid: 0,
  couldParse: 0
};

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
  console.log(stats);
  async function processFile(imagePath) {
    try {
      stats.total += 1;
      const parsedPath = parsePath(imagePath);
      const result = await readMrz(await IJS.load(imagePath), {
        debug: true,
        saveName: join(parsedPath.dir, '../multiMask/', parsedPath.base)
      });
      console.log(result);
      const parsed = parse(result);
      stats.couldParse += 1;
      console.log('valid', parsed.valid);
      if (!parsed.valid) {
        console.log(parsed.details.filter((d) => !d.valid).map((d) => d.error));
      } else {
        stats.valid += 1;
      }
      console.log(imagePath);
      const nameWithoutExt = parsedPath.base.replace(parsedPath.ext, '');
      console.log(nameWithoutExt);
      if (expected[nameWithoutExt]) {
        const reference = expected[nameWithoutExt];
        if (result.length !== reference.length) {
          console.log(
            `error: expected ${reference.length} lines, got ${result.length}`
          );
        } else {
          for (let i = 0; i < result.length; i++) {
            if (result[i] !== reference[i]) {
              const l = Math.max(reference[i].length, result[i].length);
              console.log(`line ${i + 1} does not match`);
              console.log(`expected: ${reference[i]}`);
              let matches = '          ';
              for (let j = 0; j < l; j++) {
                if (result[i][j] === reference[i][j]) {
                  matches += '-';
                } else {
                  matches += 'x';
                }
              }
              console.log(matches);
              console.log(`got:      ${result[i]}`);
            }
          }
        }
      } else {
        console.log('no reference to compare result');
      }
    } catch (e) {
      console.log('read error', e.message, e.stack);
    }
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
