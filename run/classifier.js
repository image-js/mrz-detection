var {
    detect,
    loadModel
} = require('../src/classifier/detection');

async function test() {
    var model = await loadModel();
}

test();