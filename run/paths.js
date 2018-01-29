'use strict';
const rootDir = '..';

var name = 'test';

module.exports = {
    rootDir: rootDir,
    readPath: rootDir + `/data/${name}/`,
    saveMask: rootDir + '/mask/',
    saveMRZ: rootDir + '/mrz/',
    saveHTMLFile: `${name}.html`
};
