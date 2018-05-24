'use strict';

const path = require('path');

const Image = require('image-js').Image;

const { getMrz, readMrz } = require('../..');

it(
  'test the extraction of MRZ characters on an identity card',
  async () => {
    const img = await Image.load(path.join(__dirname, 'fixtures/id1.png'));
    let mrzImage = getMrz(img);
    // mrzImage.save('./test.jpg');
    let mrz = await readMrz(mrzImage);
    expect(mrz).toMatchSnapshot();
  },
  10000
);
