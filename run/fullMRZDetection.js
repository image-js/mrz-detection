'use strict';

const fs = require('fs');
const { join } = require('path');

const IJS = require('image-js').Image;
const tableify = require('tableify');
const { loadAllFontData, runFontAnalysis } = require('ocr-tools');
const mkdirp = require('mkdirp');

var {
  codes,
  fingerprintOptions,
  roiOptions,
  getFunctions
} = require('./MRZDetection');

// options
const maskOptions = {
  invert: true,
  algorithm: 'isodata'
};

const allFingerprints = {
  baseDir: `${__dirname}/../fontData`,
  height: fingerprintOptions.height,
  width: fingerprintOptions.width,
  category: fingerprintOptions.category,
  maxSimilarity: 0.7, // we store all the different fontFingerprint
  fontName: ''
};

async function fullMRZDetection(paths) {
  var { rootDir, saveHTMLFile, saveMask, saveMRZ } = paths;
  const { filterManager, getMRZ, isMRZCorrect, getLetterStats } = getFunctions(
    paths
  );

  var allFontFingerprints = loadAllFontData(allFingerprints);

  var files = fs.readdirSync(rootDir);
  files = files.filter(
    (files) => files.endsWith('.png') || files.endsWith('.jpg')
  );
  console.log(files);
  var promises = files.map((elem) => IJS.load(join(rootDir, elem)));
  var table = [];

  const images = await Promise.all(promises);
  var counters = new Array(Object.keys(codes).length).fill(0);

  for (var i = 0; i < images.length; i++) {
    console.log('processing:', files[i]);
    var image = images[i];
    var grey = image.grey({ allowGrey: true });
    var mask = grey.mask(maskOptions);
    const pngName = files[i].replace(/\.[^.]+/, '.png');
    mkdirp.sync(saveMask);

    var maskPath = join(saveMask, pngName);
    mask.save(maskPath);
    var manager = image.getRoiManager();
    manager.fromMask(mask);

    var { parseRowInfo, rowsInfo, rois } = filterManager(manager);

    try {
      var { y, height, filteredHistogram, simPeaks, simBetweenPeaks } = getMRZ(
        parseRowInfo,
        rowsInfo,
        rois,
        image.width
      );
    } catch (e) {
      console.log('not able to find mrz for', files[i]);
      continue;
    }

    var margin = 10;

    var crop = image.crop({
      y: y - margin,
      height: height + 2 * margin
    });

    var results = runFontAnalysis(crop, allFontFingerprints, {
      fingerprintOptions: allFingerprints,
      roiOptions
    }).slice(0, 5);

    console.log(`for file ${files[i]}:`);
    for (var result of results) {
      console.log(
        '----------',
        result.fontName,
        '--',
        'Total similarity: ',
        result.totalSimilarity / result.totalFound,
        '-',
        'Total found: ',
        result.totalFound,
        '-',
        'Total not found: ',
        result.totalNotFound
      );
    }

    mkdirp.sync(saveMRZ);

    var cropPath = join(saveMRZ, pngName);
    crop.save(cropPath);

    // get letter mrz
    var { code, outputTable } = isMRZCorrect(crop, files[i]);
    counters[code]++;

    if (code === codes.PREPROCESS_ERROR.code) {
      console.log('preprocess error');
      continue;
    }

    if (code === codes.CORRECT.code) {
      console.log(`file: ${files[i]} is correct!`);
    }

    table.push({
      image: [
        `<img src="${`mask/${pngName}`}" width="600" height="600">`,
        `<img src="./${`mrz/${pngName}`}" width="600" height="200">`
      ].concat(outputTable.images),
      filename: files[i],
      'Row info median': `<span class='histogram'>${parseRowInfo.join(
        ','
      )}</span>`,
      'Filtered info median': `<span class='histogram'>${filteredHistogram.join(
        ','
      )}</span>`,
      simPeaks: simPeaks,
      simBetweenPeaks: simBetweenPeaks,
      'Error information': outputTable['Error Information'],
      'Code error': outputTable['Code Error'],
      Histogram: outputTable.Histogram
      // 'Col info median': `<span class='histogram'>${colsInfo.join(',')}</span>`
    });
  }

  console.log(getLetterStats());

  fs.writeFileSync(
    saveHTMLFile,
    `
                <!DOCTYPE html>
                <html>
                <head>
                <style>
                    html *
                    {
                        font-family: "Courier New", Courier, monospace;
                    }
                </style>
                </head>
                <body>
                ${tableify(table)}
                </body>
                <script src="https://code.jquery.com/jquery-3.2.1.js"
                integrity="sha256-DZAnKJ/6XZ9si04Hgrsxu/8s717jcIzLy3oi35EouyE="
                crossorigin="anonymous"></script>
                <script src="https://omnipotent.net/jquery.sparkline/2.1.2/jquery.sparkline.js"></script>
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
                </html>
            `
  );

  return {
    stats: getLetterStats()
  };
}

module.exports = fullMRZDetection;
