'use strict';

// eslint-disable-next-line
const fontManager = require('font-manager');

module.exports = function getInstalledRegularFonts() {
  const fonts = fontManager.getAvailableFontsSync();
  const regular = fonts.filter((a) => a.style === 'Regular');

  let names = regular.map((a) => a.postscriptName);
  // this is not really enough ... and we get rid of the font that contains some Bold, Italic or other
  names = names.filter(function (a) {
    return !a
      .toLowerCase()
      .match(/(condensed|light|bold|extra|black|narrow|medium)/);
  });

  return names.sort();
};
