'use strict';

const fs = require('fs-extra');
const path = require('path');
const IJS = require('image-js').Image;

const extensions = ['.png', '.jpeg', '.jpg'];

async function loadImages(dir) {
  const images = await readImages(dir);
  return images;
}

async function writeImages(images) {
  // eslint-disable-next-line no-await-in-loop
  for (let entry of images) {
    const { image, filePath, ...metadata } = entry;
    if (!image || !filePath) {
      throw new Error('image and filePath props are mandatory');
    }

    const baseDir = path.resolve(path.dirname(filePath));
    await fs.mkdirp(baseDir);
    const metadataPath = path.join(
      baseDir,
      path.basename(filePath).replace(path.extname(filePath), '.json')
    );

    await image.save(filePath);
    await fs.writeJson(metadataPath, metadata);
  }
}

async function readImages(dir) {
  const images = [];
  const files = await fs.readdir(dir);
  // eslint-disable-next-line no-await-in-loop
  for (let file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    let metadata;
    if (stat.isFile()) {
      const ext = path.extname(filePath);
      if (!extensions.includes(ext.toLowerCase())) {
        continue;
      }
      const image = await IJS.load(filePath);
      try {
        metadata = await fs.readJson(path.join(dir, file.replace(ext, 'json')));
      } catch (e) {
        metadata = {};
        console.log(`no metadata associated to ${filePath} found`);
      }
      images.push(
        Object.assign(metadata, {
          image,
          filePath
        })
      );
    } else {
      const dirImages = await readImages(filePath);
      for (let image of dirImages) {
        images.push(image);
      }
    }
  }
  return images;
}

module.exports = {
  loadImages,
  writeImages
};
