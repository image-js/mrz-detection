'use strict';

const path = require('path');
const IJS = require('image-js').Image;
const Matrix = require('ml-matrix').Matrix;
const filename = 'passport_01';
const rectKernel = getRectKernel(13, 5);
const sqKernel = getRectKernel(21, 21);

async function exec() {
  let img = await IJS.load(
    `/home/stropitek/projects/mrz/examples/${filename}.jpg`
  );
  // const scaled = await img.scale({ height: 600 });
  // await save(scaled, 'scaled');

  img = img.grey();
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
    algorithm: 'otsu',
  });
  // await save(img, 'otsu');

  img = img.closing({ kernel: sqKernel });
  // await save(img, 'closing2');

  img = img.erode({ iterations: 4 });
  // await save(img, 'erode');
  // img = await img.sobelFilter();
  // await save(img, 'sobel');

  img = img.floodFill({
    x: img.width - 1,
    y: img.height-1
  });
  await save(img, 'floodfill');

  removeBorders(img);
}

function removeBorders(img) {
  const maxWidth = Math.floor(0.05 * img.width);
  const maxHeight = Math.floor(0.05 * img.height);

}

exec()
  .then((result) => {
    // console.log(result);
  })
  .catch(function (e) {
    console.error('error', e);
  });

async function save(img, suffix = '') {
  await img.save(path.join(__dirname, `../data/${filename}_${suffix}.jpg`), {
    format: 'jpg'
  });
}

function getRectKernel(w, h) {
  const arr = new Array(w);
  arr.fill(new Array(h).fill(1));
  return  arr;
}
