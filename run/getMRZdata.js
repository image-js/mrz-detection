'use strict';
const IJS = require('image-js').Image;
const fs = require('fs');
const tableify = require('tableify');
const tanimoto = require('ml-distance').similarity.tanimoto;

const rootDir = '..';
const readPath = rootDir + '/data/id/';
const saveMask = rootDir + '/mask/';
const saveMRZ = rootDir + '/mrz/';
const saveHTMLFile = 'passport.html';

const roiOptions = {
    minSurface: 200,
    positive: true,
    negative: false,
    minRatio: 0.5,
    maxRatio: 2.0
};
const maskOptions = {
    invert: true,
    algorithm: 'isodata'
};
const maxSizeRoi = 800;
const filterSize = 0.82;

var files = fs.readdirSync(readPath);
console.log(files);
var promises = files.map(elem => IJS.load(readPath + elem));
var table = [];


function similarityPeaks(peaks) {
    if(peaks.length < 2) {
        throw new RangeError(`similarityPeaks expects to receive an array greater than two, received an array of length; ${peaks.length}`);
    }

    var sim = new Array(peaks.length - 1);
    for(var i = 0; i < peaks.length - 1; ++i) {
        var peak1 = peaks[i];
        var peak2 = peaks[i + 1];

        sim[i] = tanimoto([peak1.end - peak1.start], [peak2.end - peak2.start]);
    }

    return sim;
}

function similarityBetweenPeaks(peaks) {
    if(peaks.length < 3) {
        throw new RangeError(`similarityBetweenPeaks expects to receive an array greater than 3, received an array of length; ${peaks.length}`);
    }

    var sim = new Array(peaks.length - 2);
    for(var i = 0; i < peaks.length - 2; ++i) {
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
        parseRowInfo: parseInfo(rowsInfo, rois.map(elem => elem.id), checkRoi),
        rowsInfo: rowsInfo,
        rois: rois
        //colsInfo: parseInfo(colsInfo, roiIds, checkRoi),
    };
}

function getInfo(peakA, peakB) {
    return [Math.abs(peakA.end - peakB.start), peakA.end - peakA.start, peakB.end - peakB.start];
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
    var rois = transformROIs(rois);

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
                middle: Math.round(start + ((end - start) / 2))
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

    if(peaks.length === 0) {
        throw new RangeError('Not able to find the MRZ');
    }

    peaks.reverse();

    var peakStart = peaks[0];
    var peakEnd = peaks[0];
    var simPeaks = similarityPeaks(peaks);
    var simBetweenPeaks = [];

    if(peaks.length >= 2) {
        if(simPeaks[0] > 0.8) {
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

Promise.all(promises).then(function (images) {
    for (var i = 0; i < images.length; i++) {
        console.log('processing:', files[i]);
        var image = images[i];
        var grey = image.grey({allowGrey: true});
        var mask = grey.mask(maskOptions);

        if (!fs.existsSync(saveMask)) {
            fs.mkdirSync(saveMask);
        }

        var maskPath = saveMask + files[i].replace('.png', '.bmp');
        mask.save(maskPath, {
            useCanvas: false,
            format: 'bmp'
        });
        var manager = image.getRoiManager();
        manager.fromMask(mask);

        var {
            parseRowInfo,
            rowsInfo,
            rois
        } = filterManager(manager);

        try {
            var {
                y,
                height,
                filteredHistogram,
                simPeaks,
                simBetweenPeaks
            } = getMRZ(parseRowInfo, rowsInfo, rois, image.width);
        } catch (e) {
            console.log('not able to find mrz for', files[i]);
            continue;
        }

        var margin = 0;

        var crop = image.crop({
            y: y - margin,
            height: height + 2 * margin
        });

        if (!fs.existsSync(saveMRZ)) {
            fs.mkdirSync(saveMRZ);
        }
        var cropPath = saveMRZ + files[i];
        crop.save(cropPath, {
            useCanvas: false,
            format: 'png'
        });

        table.push({
            image: [
                `<img src="./${maskPath}" width="600" height="600">`,
                `<img src="./${cropPath}" width="600" height="200">`,
            ],
            'Row info median': `<span class='histogram'>${parseRowInfo.join(',')}</span>`,
            'Filtered info median': `<span class='histogram'>${filteredHistogram.join(',')}</span>`,
            simPeaks: simPeaks,
            simBetweenPeaks: simBetweenPeaks
            // 'Col info median': `<span class='histogram'>${colsInfo.join(',')}</span>`
        });
    }

    fs.writeFileSync(saveHTMLFile,
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
