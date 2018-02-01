'use strict';

const path = require('path');
const Matrix = require('ml-matrix').Matrix;
const fs = require('fs');
const minimist = require('minimist');
const IJS = require('image-js').Image;
const rectKernel = getRectKernel(9, 5);
const sqKernel = getRectKernel(19, 19);

const argv = minimist(process.argv.slice(2));

exec().catch(console.error);

async function exec() {
  if (argv.file) {
    const pathname = path.resolve(argv.file);
    await processFile(pathname);
  } else if (argv.dir) {
    const dirname = path.resolve(argv.dir);
    const files = fs.readdirSync(dirname).filter((f) => {
      f = f.toLowerCase();
      return f.endsWith('jpg') || f.endsWith('png') || f.endsWith('jpeg');
    });
    for (let file of files) {
      console.log(`process ${file}`);
      await processFile(path.join(dirname, file));
    }
  }
}

async function processFile(pathname) {
  const filename = path.basename(pathname);
  let img = await IJS.load(pathname);
  const original = img;

  // const scaled = img;
  const scaled = img.scale({ width: 500 });
  // await save(scaled, 'scaled');

  const originalToTreatedRatio = original.width / scaled.width;
  img = scaled.grey();
  // await save(img, 'gray');
  // is this formula used? (it is in opencv) sigma = 0.3(radius / 2 - 1) + 0.8;
  img = img.gaussianFilter();
  // await save(img, 'gauss');
  img = img.blackHat({ kernel: rectKernel });
  // await save(img, 'blackhat');
  img = img.scharrFilter({
    direction: 'x',
    bitDepth: 32
  });
  img = img.abs();

  img = img.rgba8().gray();
  // await save(img, 'scharr');

  img = img.closing({
    kernel: rectKernel
  });

  // await save(img, 'closing');

  img = img.mask({
    algorithm: 'otsu'
  });
  // await save(img, 'otsu');

  img = img.closing({ kernel: sqKernel });
  // await save(img, 'closing2');

  img = img.erode({ iterations: 4 });
  img = img.dilate({ iterations: 8 });
  // await save(img, 'erode');

  const roiManager = scaled.getRoiManager();
  roiManager.fromMask(img);
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
    console.log('no roi found');
    return;
  }

  if (rois.length > 1) {
    console.log('more than one matching roi found');
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

  scaled.paintMasks(masks, {
    distinctColor: true,
    alpha: 50
  });

  await save(cropped, 'cropped');

  await save(scaled, 'painted');
  // img = await img.sobelFilter();

  // img = img.floodFill({
  //   x: img.width - 1,
  //   y: img.height-1
  // });
  // await save(img, 'floodfill');

  // removeBorders(img);

  async function save(img, suffix = '') {
    await img.save(path.join(__dirname, `../data/${suffix}_${filename}`), {
      format: 'jpg'
    });
  }
}

function getRectKernel(w, h) {
  const arr = new Array(w);
  arr.fill(new Array(h).fill(1));
  return arr;
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

function checkRatio(ratio) {
  return ratio > 5 && ratio < 12;
}
