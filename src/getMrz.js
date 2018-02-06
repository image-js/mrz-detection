/*
  Port of the python script by Adrian Rosebrock:
  https://www.pyimagesearch.com/2015/11/30/detecting-machine-readable-zones-in-passport-images/
 */

'use strict';

const { Matrix } = require('ml-matrix');

const rectKernel = getRectKernel(9, 5);
const sqKernel = getRectKernel(19, 19);

function getMrz(image, options = {}) {
  const { keepIntermediateImages: debug = false } = options;
  const original = image;

  const images = {};

  const scaled = image.scale({ width: 500 });
  if (debug) images.scaled = scaled;

  const originalToTreatedRatio = original.width / scaled.width;
  image = scaled.grey();
  if (debug) images.grey = image;

  image = image.gaussianFilter({ radius: 1 });
  if (debug) images.gaussian = image;

  image = image.blackHat({ kernel: rectKernel });
  if (debug) images.blackhat = image;

  image = image.scharrFilter({
    direction: 'x',
    bitDepth: 32
  });
  image = image.abs();
  image = image.rgba8().grey();
  if (debug) images.scharr = image;

  image = image.closing({
    kernel: rectKernel
  });
  if (debug) images.closing = image;

  image = image.mask({
    algorithm: 'otsu'
  });
  if (debug) images.mask = image;

  image = image.closing({ kernel: sqKernel });
  if (debug) images.closing2 = image;

  image = image.erode({ iterations: 4 });
  image = image.dilate({ iterations: 8 });
  if (debug) images.erode = image;

  const roiManager = scaled.getRoiManager();
  roiManager.fromMask(image);
  let rois = roiManager.getRois({
    minSurface: 8000
    // minWidth: 400
  });

  var masks = rois.map((roi) => roi.getMask());
  const bounding = masks.map((mask) => mask.minimalBoundingRectangle());

  rois = rois.map((roi, idx) => {
    const b = bounding[idx];
    let dv;
    const d1 = getDistance(b[0], b[1]);
    const d2 = getDistance(b[1], b[2]);
    let ratio = d1 / d2;
    if (ratio < 1) ratio = 1 / ratio;
    if (d1 > d2) {
      dv = getDiffVector(b[0], b[1]);
    } else {
      dv = getDiffVector(b[1], b[2]);
    }
    const horizontal = new Matrix([[1, 0]]);
    const d = Math.sqrt(
      dv.get(0, 0) * dv.get(0, 0) + dv.get(0, 1) * dv.get(0, 1)
    );
    let angle = 180 * Math.acos(horizontal.dot(dv) / d) / Math.PI;
    if (angle > 90) {
      angle -= 180;
    }
    return {
      meta: {
        angle,
        ratio
      },
      roi: roi
    };
  });

  rois = rois.filter((roi) => checkRatio(roi.meta.ratio));

  masks = rois.map((roi) => roi.roi.getMask());
  if (rois.length === 0) {
    throw new Error('no roi found');
  }

  if (rois.length > 1) {
    rois.sort((a, b) => b.roi.surface - a.roi.surface);
  }

  const cropped = original
    .crop({
      x: rois[0].roi.minX * originalToTreatedRatio,
      y: rois[0].roi.minY * originalToTreatedRatio,
      width: (rois[0].roi.maxX - rois[0].roi.minX) * originalToTreatedRatio,
      height: (rois[0].roi.maxY - rois[0].roi.minY) * originalToTreatedRatio
    })
    .rotate(rois[0].meta.angle);
  if (debug) images.cropped = cropped;

  if (debug) {
    const painted = scaled.clone().paintMasks(masks, {
      distinctColor: true,
      alpha: 50
    });
    images.painted = painted;
  }

  return debug ? images : cropped;
}

function getRectKernel(w, h) {
  const arr = new Array(w);
  arr.fill(new Array(h).fill(1));
  return arr;
}

function checkRatio(ratio) {
  return ratio > 5 && ratio < 12;
}

function getDistance(p1, p2) {
  const dv = getDiffVector(p1, p2);
  return Math.sqrt(dv.get(0, 0) * dv.get(0, 0) + dv.get(0, 1) * dv.get(0, 1));
}

function getDiffVector(p1, p2) {
  const v1 = new Matrix([p1]);
  const v2 = new Matrix([p2]);
  const dv = v2.sub(v1);
  return dv;
}

module.exports = getMrz;
