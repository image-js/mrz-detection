'use strict';

const path = require('path');

const Image = require('image-js').Image;

const { getMrz, readMrz } = require('../..');

it(
  'test the extraction of MRZ characters on an identity card',
  async () => {
    const img = await Image.load(path.join(__dirname, 'fixtures/id1.jpg'));
    let mrzImage = getMrz(img);
    // mrzImage.save('./test.jpg');
    let { mrz } = await readMrz(mrzImage);
    expect(mrz).toMatchSnapshot();
  },
  15000
);

it(
  'test the extraction of MRZ characters on an identity card 2',
  async () => {
    const img = await Image.load(path.join(__dirname, 'fixtures/id2.jpg'));
    let mrzImage = getMrz(img);
    let { mrz } = await readMrz(mrzImage);
    expect(mrz).toMatchSnapshot();
  },
  15000
);
