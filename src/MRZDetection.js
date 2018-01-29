'use strict';

const tanimoto = require('ml-distance').similarity.tanimoto;
const parse = require('mrz').parse;
const fs = require('fs');
const { loadFontData } = require('ocr-tools');

const symbols = require('../src/symbols'); // SYMBOLS MRZ NUMBERS
const runMRZ = require('../src/runMRZ');
const LettersStats = require('../src/LettersStatistics');

// options
const { saveMRZ, rootDir, readPath } = require('../run/paths');

const codes = {
  PREPROCESS_ERROR: {
    code: 0,
    save: '/preprocess/'
  },
  CORRECT: {
    code: 1,
    save: '/correct/'
  },
  MRZ_PARSE_ERROR: {
    // Invalid MRZ given by the parser (data that maybe doesn't have sense)
    code: 2,
    save: '/notParse/'
  },
  NO_DETECTED_TEXT: {
    // different sizes of each MRZ line
    code: 3,
    save: '/notDetected/'
  },
  NOT_FOUND_LETTERS: {
    // Undetectable letters by runMRZ method
    code: 4,
    save: '/notFound/'
  }
};

var codeNames = Object.keys(codes);

const roiOptions = {
  minSurface: 300,
  positive: true,
  negative: false,
  minRatio: 0.3,
  maxRatio: 2.0,
  algorithm: 'isodata',
  randomColors: true
};

const fingerprintOptions = {
  height: 12,
  width: 12,
  minSimilarity: 0.5,
  fontName: 'ocrb',
  category: symbols.label,
  ambiguity: true
};

const maxSizeRoi = 800;
const filterSize = 0.82;

// functions to get MRZ

var lettersStats = new LettersStats(`${readPath}ground.csv`);
var checkRoi = (number) => number >= 15 && number <= 50;

function similarityPeaks(peaks) {
  if (peaks.length < 2) {
    throw new RangeError(
      `similarityPeaks expects to receive an array greater than two, received an array of length; ${
        peaks.length
      }`
    );
  }

  var sim = new Array(peaks.length - 1);
  for (var i = 0; i < peaks.length - 1; ++i) {
    var peak1 = peaks[i];
    var peak2 = peaks[i + 1];

    sim[i] = tanimoto([peak1.end - peak1.start], [peak2.end - peak2.start]);
  }

  return sim;
}

function similarityBetweenPeaks(peaks) {
  if (peaks.length < 3) {
    throw new RangeError(
      `similarityBetweenPeaks expects to receive an array greater than 3, received an array of length; ${
        peaks.length
      }`
    );
  }

  var sim = new Array(peaks.length - 2);
  for (var i = 0; i < peaks.length - 2; ++i) {
    var peak1 = peaks[i];
    var peak2 = peaks[i + 1];
    var peak3 = peaks[i + 2];

    var info1 = getInfo(peak2, peak1);
    var info2 = getInfo(peak3, peak2);

    sim[i] = tanimoto(info1, info2);
  }

  return sim;
}

function parseInfo(info, roiIds, check) {
  var size = info.length;
  var arr = new Array(size).fill(0);
  for (var i = 0; i < size; ++i) {
    var currentInfo = info[i].positiveRoiIDs;
    for (var j = 0; j < currentInfo.length; j++) {
      var id = parseInt(currentInfo[j]);
      if (roiIds.includes(id)) {
        arr[i]++;
      }
    }
    arr[i] = check(arr[i]) ? info[i].medianChange : 0;
  }

  return arr;
}

function filterManager(manager) {
  var rois = manager.getRois(roiOptions);
  var rowsInfo = manager.getMap().rowsInfo();
  //var colsInfo = manager.getMap().colsInfo();

  return {
    parseRowInfo: parseInfo(rowsInfo, rois.map((elem) => elem.id), checkRoi),
    rowsInfo: rowsInfo,
    rois: rois
    //colsInfo: parseInfo(colsInfo, roiIds, checkRoi),
  };
}

function getInfo(peakA, peakB) {
  return [
    Math.abs(peakA.end - peakB.start),
    peakA.end - peakA.start,
    peakB.end - peakB.start
  ];
}

function transformROIs(rois) {
  var output = {};
  for (var i = 0; i < rois.length; ++i) {
    var roiId = rois[i].id;
    output[roiId] = rois[i];
  }

  return output;
}

function getMRZ(medianHistogram, rowsInfo, rois, imageWidth) {
  console.log('start getMRZ');
  rois = transformROIs(rois);

  var peaks = [];
  var start;

  // get all median histogram by row
  for (var i = 0; i < medianHistogram.length; i++) {
    var element = medianHistogram[i];
    if (element !== 0 && start === undefined) {
      start = i;
    } else if (element === 0 && start) {
      var end = i - 1;
      peaks.push({
        start: start,
        end: end,
        middle: Math.round(start + (end - start) / 2)
      });
      start = undefined;
    }
  }

  var filteredPeaks = [];
  var filteredHistogram = new Array(medianHistogram.length).fill(0);
  // check if the center of each peak contains ROI's greater that certain percentage
  for (i = 0; i < peaks.length; i++) {
    var minX = Number.MAX_VALUE;
    var maxX = 0;
    var middlePoint = peaks[i].middle;
    var currentInfo = rowsInfo[middlePoint].positiveRoiIDs;
    for (var j = 0; j < currentInfo.length; ++j) {
      // TODO: why roisId return a string instead of number
      var currentRoi = rois[parseInt(currentInfo[j])];
      if (currentRoi && currentRoi.maxX - currentRoi.minX < maxSizeRoi) {
        minX = Math.min(minX, currentRoi.minX);
        maxX = Math.max(maxX, currentRoi.maxX);
      }
    }

    console.log('filter size:', (maxX - minX) / imageWidth);
    if ((maxX - minX) / imageWidth > filterSize) {
      var currentPeak = peaks[i];
      filteredPeaks.push(currentPeak);
      for (j = currentPeak.start; j < currentPeak.end; ++j) {
        filteredHistogram[j] = medianHistogram[j];
      }
    }
  }

  peaks = filteredPeaks;
  console.log('total peaks', peaks.length);

  if (peaks.length === 0) {
    throw new RangeError('Not able to find the MRZ');
  }

  peaks.reverse();

  var peakStart = peaks[0];
  var peakEnd = peaks[0];
  var simPeaks = similarityPeaks(peaks);
  var simBetweenPeaks = [];

  if (peaks.length >= 2) {
    if (simPeaks[0] > 0.8) {
      peakEnd = peaks[1];
    }

    if (peaks.length > 2) {
      simBetweenPeaks = similarityBetweenPeaks(peaks);
      for (i = 0; i < simBetweenPeaks.length; ++i) {
        if (simBetweenPeaks[i] > 0.88) {
          peakEnd = peaks[i + 2];
        } else {
          break;
        }
      }
    }
  }

  // we have to swap it because we apply a reverse over peaks variable
  [peakStart, peakEnd] = [peakEnd, peakStart];

  simPeaks.reverse();
  simBetweenPeaks.reverse();

  return {
    y: peakStart.start,
    height: peakEnd.end - peakStart.start,
    filteredHistogram,
    simPeaks,
    simBetweenPeaks
  };
}

// functions to parse mrz
function saveImage(images, code, filename, errorInformation = '') {
  var { img, mask, painted } = images;
  var saveDir = rootDir + code.save;

  var grey = img.grey({ allowGrey: true });

  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir);
  }
  // fs.copyFileSync(saveMRZ + filename, saveDir + filename);

  let maskFilename = filename.replace(/\.[A-Za-z]*$/, '_mask.bmp');
  let paintedFilename = filename.replace(/\.[A-Za-z]*$/, '_painted.png');

  mask.save(saveDir + maskFilename, {
    useCanvas: false,
    format: 'bmp'
  });
  painted.save(saveDir + paintedFilename, {
    useCanvas: false,
    format: 'png'
  });

  //img.save(rootDir + code.save + filename);
  return {
    code: code.code,
    outputTable: {
      images: [
        `<img src="${saveMRZ + filename}" width="500" height="100">`,
        `<img src="${saveDir + maskFilename}" width="500" height="100">`,
        `<img src="${saveDir + paintedFilename}" width="500" height="100">`
      ],
      'Error Information': errorInformation,
      'Code Error': `<font color=${code.code === 0 ? 'green' : 'red'}> ${
        codeNames[code.code]
      } </font>`,
      // filename: filename,
      Histogram: `<span class='histogram'>${grey.histogram.join(',')}</span>`
    }
  };
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
  var fontFingerprint = loadFontData(fingerprintOptions);
  try {
    var { ocrResult, mask, painted, averageSurface } = runMRZ(
      image,
      fontFingerprint,
      {
        roiOptions,
        fingerprintOptions
      }
    );
  } catch (e) {
    console.log(e);
    return codes.PREPROCESS_ERROR;
  }

  //console.timeEnd('full OCR process');

  averageSurface = averageSurface.toFixed(2);
  var images = {
    img: image,
    mask,
    painted
  };

  var textStats = ocrResult.lines.map(getTextNoReplace);
  lettersStats.check(filename, textStats);

  var text = textStats.join('\n');
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

function getLetterStats() {
  return lettersStats.getResults();
}

module.exports = {
  filterManager,
  getMRZ,
  isMRZCorrect,
  getLetterStats,
  codes,
  fingerprintOptions,
  roiOptions
};
