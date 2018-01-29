'use strict';

const fs = require('fs');
const IJS = require('image-js').Image;
const parse = require('mrz').parse;
const tableify = require('tableify');
const { join } = require('path');

const runMRZ = require('../src/runMRZ');
const loadFontFingerprint = require('../src/util/loadFontData');
const symbols = require('../src/util/symbolClasses').MRZ; // SYMBOLS MRZ NUMBERS

const codes = {
  PREPROCESS_ERROR: {
    code: 0,
    save: 'preprocess'
  },
  CORRECT: {
    code: 1,
    save: 'correct'
  },
  MRZ_PARSE_ERROR: {
    // Invalid MRZ given by the parser (data that maybe doesn't have sense)
    code: 2,
    save: 'notParse'
  },
  NO_DETECTED_TEXT: {
    // different sizes of each MRZ line
    code: 3,
    save: 'notDetected'
  },
  NOT_FOUND_LETTERS: {
    // Undetectable letters by runMRZ method
    code: 4,
    save: 'notFound'
  }
};

var codeNames = Object.keys(codes);

var table = [];

var options = {
  roiOptions: {
    minSurface: 300,
    positive: true,
    negative: false,
    maxWidth: 50,
    //greyThreshold: 0.5,
    algorithm: 'isodata',
    randomColors: true
    //level: true // we recalculate the greyThreshold based
    // on min / max values of the grey image
  },
  fingerprintOptions: {
    height: 12,
    width: 12,
    minSimilarity: 0.5,
    fontName: 'ocrb',
    category: symbols.label
  }
};

function saveImage(images, code, filename, errorInformation = '') {
  var { img, mask, painted } = images;
  var saveDir = join(rootDir, code.save);

  var grey = img.grey({ allowGrey: true });

  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir);
  }
  fs.copyFileSync(join(readDirectory, filename), join(saveDir, filename));

  let maskFilename = filename.replace(/\.[A-Za-z]*$/, '_mask.png');
  let paintedFilename = filename.replace(/\.[A-Za-z]*$/, '_painted.png');

  mask.save(join(saveDir, maskFilename));
  painted.save(join(saveDir, paintedFilename));

  //img.save(join(rootDir, code.save, filename));
  table.push({
    images: [
      `<img src="./${join(code.save, filename)}" width="500" height="100">`,
      `<img src="./${join(code.save, maskFilename)}" width="500" height="100">`,
      `<img src="./${join(
        code.save,
        paintedFilename
      )}" width="500" height="100">`
    ],
    'Error Information': errorInformation,
    'Code Error': `<font color=${code.code === 0 ? 'green' : 'red'}> ${
      codeNames[code.code]
    } </font>`,
    // filename: filename,
    Histogram: `<span class='histogram'>${grey.histogram.join(',')}</span>`
  });
  return code.code;
}

var notFound = (line) => line.notFound;
var getTextReplace = (line) => line.text.replace(/</g, '&lt;');
var getTextNoReplace = (line) => line.text;

function getTextAndSize(ocrResult) {
  let result = ocrResult.lines.map(getTextReplace);
  let notFoundSizes = ocrResult.lines.map(notFound);
  let output = [];
  for (let i = 0; i < result.length; i++) {
    var ocrElement = result[i];
    var notFoundSize = notFoundSizes[i];
    var toSave = {
      line: ocrElement,
      'size (not found)': `${ocrResult.lines[i].text.length}(${notFoundSize})`
    };
    output.push(toSave);
    //var str = `size(not found): ${ocrElement.length}(${notFoundSize})`;
  }
  return output;
}

function isMRZCorrect(image, filename) {
  // console.log('Image size: ',image.width,image.height),
  //console.time('full OCR process');
  try {
    var { ocrResult, mask, painted, averageSurface } = runMRZ(
      image,
      fontFingerprint,
      options
    );
  } catch (e) {
    // console.log(e);
    return codes.PREPROCESS_ERROR;
  }

  //console.timeEnd('full OCR process');

  averageSurface = averageSurface.toFixed(2);
  var images = {
    img: image,
    mask,
    painted
  };

  var text = ocrResult.lines.map(getTextNoReplace).join('\n');
  var size;
  for (var line of ocrResult.lines) {
    if (line.notFound) {
      return saveImage(images, codes.NOT_FOUND_LETTERS, filename, {
        lines: getTextAndSize(ocrResult),
        'Avg SA': averageSurface
      });
    }

    /*if (size && size !== line.found) {
            return saveImage(images, codes.NO_DETECTED_TEXT, filename, {
                lines: getTextAndSize(ocrResult),
                'Avg SA': averageSurface
            });
        } else {
            size = line.found;
        }*/
  }
  /*console.log('Total similarity',result.totalSimilarity);
    console.log('Total found',result.totalFound);
    console.log('Total not found',result.totalNotFound);*/

  // for the first line we just show the roiOptions
  /*for (var roi of result.lines[1].rois) {
        console.log(JSON.stringify(roi));
    }*/
  // console.log(`Parsing ${text}`);
  var data = parse(text);
  if (!data.isValid) {
    return saveImage(images, codes.MRZ_PARSE_ERROR, filename, {
      lines: getTextAndSize(ocrResult),
      errors: data.error,
      'Avg SA': averageSurface
    });
  }

  return saveImage(images, codes.CORRECT, filename, {
    'Avg SA': averageSurface
  });
}

var files = fs.readdirSync(readDirectory);

var fontFingerprint = loadFontFingerprint(options.fingerprintOptions);
var promises = files.map((elem) => IJS.load(join(readDirectory, elem)));

Promise.all(promises).then(function (elems) {
  var counters = new Array(Object.keys(codes).length).fill(0);

  //var output = elems.map(elem => isMRZCorrect(elem));
  for (var i = 0; i < elems.length; i++) {
    var elem = elems[i];
    console.log(`Processing file: ${files[i]}`);
    var code = isMRZCorrect(elem, files[i]);
    counters[code]++;

    if (code === codes.CORRECT) {
      console.log(`file: ${files[i]} is correct!`);
    }
  }

  var final = [];
  for (i = 0; i < codeNames.length; ++i) {
    var currentCode = codeNames[i];
    console.log(
      `Elements with code ${currentCode}: ${counters[codes[currentCode].code]}`
    );
    final.push([currentCode, counters[codes[currentCode].code]]);
  }
  console.log(`total elements: ${elems.length}`);
  final.push(['total', elems.length]);

  table = {
    table: table,
    count: final
  };

  fs.writeFileSync(
    `${rootDir}/table.html`,
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
});
