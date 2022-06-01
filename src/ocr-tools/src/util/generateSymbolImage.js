'use strict';

const IJS = require('image-js').Image;

const SYMBOLS = require('./symbolClasses').MRZ;

function generateSymbolImage(options = {}) {
  let {
    fontSize = 24,
    fontName = 'Helvetica',
    numberPerLine = 11,
    allowedRotation = 2,
    backgroundColor = 255,
    symbols = SYMBOLS.symbols
  } = options;

  const grid = Math.floor(fontSize * 1.2);
  fontName = `${fontSize}px ${fontName}`;

  // default RGBA 8bits
  const image = new IJS(
    (numberPerLine + 2) * grid,
    (symbols.length + 2) * grid
  );

  // the imageOptions is now white
  const data = image.data;
  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 3) continue;
    data[i] = backgroundColor;
  }

  const rotate = [];
  const paintOptions = {
    font: fontName,
    color: 'black',
    rotate: rotate
  };

  const labels = [];
  const positions = [];

  for (let y = 0; y < symbols.length; y++) {
    const text = String.fromCharCode(symbols[y]);
    for (let x = 0; x < numberPerLine; x++) {
      const position = [x * grid + grid, y * grid + grid];
      positions.push(position);
      labels.push(text);
      rotate.push(
        2 * allowedRotation * x / (numberPerLine - 1) - allowedRotation
      );
    }
  }
  image.paintLabels(labels, positions, paintOptions);
  return { image, chars: labels };
}

module.exports = generateSymbolImage;
