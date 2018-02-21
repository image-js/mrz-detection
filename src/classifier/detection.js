var {Image} = require('image-js');
var fs = require('fs');
var strokeWidthTransform = require('stroke-width-transform');

async function loadModel() {
  var XGBoost = await require('ml-xgboost');
  var labels = JSON.parse(fs.readFileSync('./src/classifier/models/labels.json', 'utf8'));

  var model = XGBoost.loadFromModel('./src/classifier/models/ocr-letter.model', {
    labels
  });
  return model;
}

async function detect(model, filename) {
  const letterOptions = {
    width: 20,
    height: 27
  };

  const roiOptions = {
    positive: true,
    negative: false,
    minRatio: 0.3,
    maxRatio: 2.0,
    algorithm: 'otsu',
    randomColors: true
  };

  const swtOptions = {
    interval: 2,
    minNeighboors: 2,
    scaleInvariant: 1,
    direction: 0,
    size: 1,
    lowThreshold: 124,
    highThresh: 204,
    maxHeight: 300,
    minHeight: 8,
    minArea: 38,
    letterOcclude: 3,
    aspectRatio: 8,
    stdRatio: 0.83,
    thickRatio: 1.3,
    heightRatio: 1.7,
    intensityThresh: 31,
    distanceRatio: 2.9,
    intersectRatio: 1.3,
    elongateRatio: 1.9,
    letterThresh: 3,
    breakdown: 1,
    breakdownRatio: 1,
  };

  var testImage = await Image.load(filename);
  var rois = strokeWidthTransform(testImage);

  drawRois(testImage, rois);
  var masks = new Array(rois.length);
  for (var i = 0; i < rois.length; ++i) {
    masks[i] = testImage.extract(rois[i].getMask()).grey();
  }

  var predictions = new Array(masks.length);
  for (i = 0; i < masks.length; ++i) {
    var newImage = masks[i];
    var mask = newImage.mask({
      algorithm: roiOptions.algorithm,
      invert: true
    });

    var manager = newImage.getRoiManager();
    manager.fromMask(mask);
    var currentRois = manager.getRois(roiOptions);

    // drawRois(newImage, currentRois);
    if(currentRois.length === 0) {
      predictions[i] = {
        image: mask,
        prediction: []
      };
      continue;
    }
    var toPredict = new Array(currentRois.length);
    for (var j = 0; j < currentRois.length; ++j) {
      var scaledMask = currentRois[j].getMask().scale({
        width: letterOptions.width,
        height: letterOptions.height
      });
      toPredict[j] = getBinaryArray(scaledMask);
    }
    var timeLabel = `Prediction time for ${toPredict.length} ROI's`
    console.time(timeLabel);
    var output = model.predict(toPredict);
    console.timeEnd(timeLabel);

    predictions[i] = {
      image: mask,
      prediction: output
    };
  }

  return {
    testImage,
    predictions,
  }
}

function getBinaryArray(mask) {
  var width = mask.width;
  var height = mask.height;
  var output = [];
  for (var x = 0; x < height; ++x) {
    for (var y = 0; y < width; ++y) {
      output.push(mask.getBitXY(y, x));
    }
  }

  return output;
}

function drawRois(image, rois) {
  rois.forEach(function (roi) {
    var small = roi.getMask();
    roi.data = Array.from(small.data);

    // draw bounding boxes
    var mask = roi.getMask();

    var mbr = mask.minimalBoundingRectangle();

    mbr = mbr.map((point) =>
      [
        point[0] + mask.position[0],
        point[1] + mask.position[1]
      ]
    );
    image.paintPolyline(mbr, { color: [255, 0, 0] });
  });

  return image;
}

module.exports = {
  loadModel,
  detect
}