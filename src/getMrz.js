/*
  Port of the python script by Adrian Rosebrock:
  https://www.pyimagesearch.com/2015/11/30/detecting-machine-readable-zones-in-passport-images/
 */

'use strict';

const degreesRadians = require('degrees-radians');
const { Matrix } = require('ml-matrix');
const {
  rotate,
  translate,
  transform,
  applyToPoint,
  applyToPoints
} = require('transformation-matrix');

const rectKernel = getRectKernel(9, 5);
const sqKernel = getRectKernel(15, 15);

function getMrz(image, options) {
  try {
    return internalGetMrz(image, options);
  } catch (e) {
    return internalGetMrz(image.rotateLeft(), options);
  }
}

function internalGetMrz(image, options = {}) {
  const { debug = false, out = {} } = options;

  const original = image;

  const images = out;

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
    minSurface: 5000
    // minWidth: 400
  });

  var masks = rois.map((roi) => roi.getMask());
  const bounding = masks.map((mask) => mask.minimalBoundingRectangle());

  rois = rois.map((roi, idx) => {
    const b = bounding[idx];
    let dv;
    let d1 = getDistance(b[0], b[1]);
    let d2 = getDistance(b[1], b[2]);
    if (d2 > d1) {
      [d1, d2] = [d2, d1];
      dv = getDiffVector(b[1], b[2]);
    } else {
      dv = getDiffVector(b[0], b[1]);
    }
    if (dv.get(0, 0) < 0) {
      dv.set(0, 0, -dv.get(0, 0));
      dv.set(0, 1, -dv.get(0, 1));
    }

    let ratio = d1 / d2;

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
        ratio,
        regionWidth: d1,
        regionHeight: d2
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

  if (debug) {
    const painted = scaled.clone().paintMasks(masks, {
      distinctColor: true,
      alpha: 50
    });
    images.painted = painted;
  }

  let toCrop = original;

  const mrzRoi = rois[0];
  let angle = mrzRoi.meta.angle;
  let regionTransform;
  if (Math.abs(angle) > 45) {
    if (angle < 0) {
      toCrop = toCrop.rotateRight();
      angle = -90 - angle;
      regionTransform = transform(
        rotate(Math.PI / 2),
        translate(toCrop.width, 0)
      );
    } else {
      toCrop = toCrop.rotateLeft();
      angle = 90 - angle;
      regionTransform = transform(
        rotate(-Math.PI / 2),
        translate(-toCrop.height, 0)
      );
    }
  }
  let mrzCropOptions;
  if (Math.abs(angle) < 1) {
    mrzCropOptions = {
      x: mrzRoi.roi.minX * originalToTreatedRatio,
      y: mrzRoi.roi.minY * originalToTreatedRatio,
      width: (mrzRoi.roi.maxX - mrzRoi.roi.minX) * originalToTreatedRatio,
      height: (mrzRoi.roi.maxY - mrzRoi.roi.minY) * originalToTreatedRatio
    };
    if (regionTransform) {
      const rotated = applyToPoint(regionTransform, mrzCropOptions);
      const tmp = mrzCropOptions.width;
      mrzCropOptions.width = mrzCropOptions.height;
      mrzCropOptions.height = tmp;
      mrzCropOptions.x = rotated.x;
      mrzCropOptions.y = rotated.y - mrzCropOptions.height;
    }
  } else {
    // convex hull relative to the original image's viewport
    let hull = mrzRoi.roi.mask.monotoneChainConvexHull().map(([x, y]) => ({
      x: (mrzRoi.roi.minX + x) * originalToTreatedRatio,
      y: (mrzRoi.roi.minY + y) * originalToTreatedRatio
    }));

    if (regionTransform) {
      hull = applyToPoints(regionTransform, hull);
    }

    const beforeRotate = toCrop;
    const afterRotate = beforeRotate.rotate(angle, {
      interpolation: 'bilinear'
    });

    const widthDiff = (afterRotate.width - beforeRotate.width) / 2;
    const heightDiff = (afterRotate.height - beforeRotate.height) / 2;

    const transformation = transform(
      getRotationAround(beforeRotate, angle),
      translate(widthDiff, heightDiff)
    );

    const rotatedHull = applyToPoints(transformation, hull);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of rotatedHull) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }

    minX = Math.max(0, Math.round(minX));
    minY = Math.max(0, Math.round(minY));
    maxX = Math.min(afterRotate.width, Math.round(maxX));
    maxY = Math.min(afterRotate.height, Math.round(maxY));

    mrzCropOptions = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    toCrop = afterRotate;
  }

  if (mrzCropOptions.y < toCrop.height / 2) {
    // image is upside down, turn it back
    toCrop = toCrop.rotate(180);
    const newXY = applyToPoint(getRotationAround(toCrop, 180), mrzCropOptions);
    mrzCropOptions.x = newXY.x - mrzCropOptions.width;
    mrzCropOptions.y = newXY.y - mrzCropOptions.height;
  }

  let cropped = toCrop.crop(mrzCropOptions);
  if (debug) images.crop = cropped;

  return debug ? { images } : cropped;
}

function getRectKernel(w, h) {
  const arr = new Array(w);
  arr.fill(new Array(h).fill(1));
  return arr;
}

function checkRatio(ratio) {
  return ratio > 4 && ratio < 12;
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

function getRotationAround(image, angle) {
  const middle = { x: image.width / 2, y: image.height / 2 };
  return transform(
    translate(middle.x, middle.y),
    rotate(degreesRadians(angle)),
    translate(-middle.x, -middle.y)
  );
}

module.exports = getMrz;
