'use strict';

module.exports = {
  getLinesFromImage: require('./util/getLinesFromImage'),
  doOcrOnLines: require('./util/doOcrOnLines'),
  groupRoisPerLine: require('./util/groupRoisPerLine'),
  runFontAnalysis: require('./runFontAnalysis'),
  loadAllFontData: require('./util/loadAllFontData'),
  loadFontData: require('./util/loadFontData'),
  generateSymbolImage: require('./util/generateSymbolImage')
};
