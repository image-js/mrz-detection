'use strict';

const path = require('path');

const fs = require('fs-extra');
const minimist = require('minimist');
const { Image } = require('image-js');

const { getMrz } = require('..');

const argv = minimist(process.argv.slice(2));

exec().catch(console.error);

async function exec() {
  if (argv.file) {
    const pathname = path.resolve(argv.file);
    console.time(pathname);
    const result = {};
    try {
      await getMrz(await Image.load(pathname), {
        debug: true,
        out: result
      });
    } catch (e) {
      console.error(e);
    }
    console.timeEnd(pathname);
    await saveImages(
      pathname,
      result,
      path.join(path.dirname(pathname), 'out')
    );
    await saveSingleReport(
      pathname,
      result,
      path.join(path.dirname(pathname), 'out')
    );
  } else if (argv.dir) {
    const dirname = path.resolve(argv.dir);
    const files = (await fs.readdir(dirname)).filter((f) => {
      f = f.toLowerCase();
      return f.endsWith('jpg') || f.endsWith('png') || f.endsWith('jpeg');
    });
    const out = path.join(dirname, 'out');
    const toSave = [];
    await fs.emptyDir(out);
    for (let file of files) {
      console.log(`process ${file}`);
      const imagePath = path.join(dirname, file);
      console.time(imagePath);
      const result = {};
      try {
        getMrz(await Image.load(imagePath), {
          debug: true,
          out: result
        });
      } catch (e) {
        console.error(e);
      }
      console.timeEnd(imagePath);
      await saveImages(imagePath, result, out);
      toSave.push([imagePath, result]);
    }
    await saveReports(toSave, out);
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

const head = `
<head>
  <script src="https://code.jquery.com/jquery-3.2.1.js"></script>
  <script src="https://omnipotent.net/jquery.sparkline/2.1.2/jquery.sparkline.js"></script>
</head>
`;

const sparklines = `
<script type="text/javascript">
$(function() {
    /** This code runs when everything has been loaded on the page */
    /* Inline sparklines take their values from the contents of the tag */
    $('.histogram').sparkline('html', {
        type: 'line',
        width: 400,
        height: 100
    }); 
});
</script>
`;

async function saveSingleReport(imagePath, images, out) {
  const prefixes = Object.keys(images);
  const report = `
    <!doctype html>
      <body>
        ${head}
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              ${getHeaders(prefixes)}
            </tr>
            ${getTableRow(imagePath, prefixes, images)}
          </tbody>
        </table>
        ${sparklines}
      </body>
    </html>
  `;
  await fs.writeFile(path.join(out, 'report.html'), report);
}

async function saveReports(results, out) {
  let longestResult = { length: 0 };
  const rows = [];
  for (const [imagePath, images] of results) {
    const prefixes = Object.keys(images);
    if (prefixes.length > longestResult.length) {
      longestResult = prefixes;
    }
    rows.push(getTableRow(imagePath, prefixes, images));
  }

  const report = `
    <!doctype html>
      ${head}
      <body>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              ${getHeaders(longestResult)}
            </tr>
            ${rows.join('\n')}
          </tbody>
        </table>
        ${sparklines}
      </body>
    </html>
  `;
  await fs.writeFile(path.join(out, 'report.html'), report);
}

function getHeaders(prefixes) {
  return prefixes.map((prefix) => `<th>${prefix}</th>`).join('\n');
}

function getTableRow(imagePath, prefixes, images) {
  const filename = path.basename(imagePath);
  const ext = path.extname(filename);
  const pngName = filename.replace(ext, '.png');
  return `
    <tr>
      <td>${filename}</td>
      ${prefixes
    .map(
      (prefix) =>
        `<td><img style="max-width: 500px;" src="${prefix}/${pngName}"</td>`
    )
    .join('\n')}
      <td>${
  images.crop
    ? `<span class="histogram">${images.crop
      .grey()
      .histogram.join(',')}</span>`
    : ''
}</td>
    </tr>
  `;
}
