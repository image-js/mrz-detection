const minimist = require('minimist');
const fs = require('fs');
const tableify = require('tableify');
const path = require('path');
const {
    detect,
    loadModel
} = require('../src/classifier/detection');

const argv = minimist(process.argv.slice(2));
const head = `
<head>
  <script src="https://code.jquery.com/jquery-3.2.1.js"></script>
  <script src="https://omnipotent.net/jquery.sparkline/2.1.2/jquery.sparkline.js"></script>
</head>
`;

async function exec() {
    var model = await loadModel();
    var filesDir = fs.readdirSync(argv.dir).filter(elem => elem.endsWith('.png'));
    // filesDir = [filesDir[0], filesDir[2], filesDir[3]];
    var table = new Array(filesDir.length);
    var saveDir = `${argv.dir}/rois`;
    createDir(saveDir);
    for(var i = 0; i < filesDir.length; ++i) {
        var filename = filesDir[i];

        var currentTable = await detect(model, path.join(argv.dir, filename));
        filename = filename.slice(0, filename.length - 4);
        
        var drawRoisPath = path.join(saveDir, `${filename}-rois.png`);
        currentTable.testImage.save(drawRoisPath);
        currentTable.testImage = toHTMLImage(drawRoisPath, 300, 300);

        var predictions = currentTable.predictions;
        for(var j = 0; j < predictions.length; ++j) {
            var currentPrediction = predictions[j];
            if(currentPrediction === undefined) {
                continue;
            }

            var saveMask = path.join(saveDir, `${filename}-${j+1}.png`);
            currentPrediction.image.save(saveMask);
            currentPrediction.image = toHTMLImage(saveMask, 300, 25);
            currentPrediction.prediction = currentPrediction.prediction.join('').replace(/</g, '&lt');
            //console.log(predictions[j].prediction)
        }

        table[i] = currentTable;
    }

    fs.writeFileSync('output.html', 
        `
            <!doctype html>
                <body>
                    ${tableify(table)}
                </body>
            </html>
        `);
}

exec().catch(console.error);

function toHTMLImage(filepath, width, height) {
    return `<img src="${filepath}" width="${width}" height="${height}">`;
}

function createDir(saveDirectory) {
    if(!fs.existsSync(saveDirectory)) {
        fs.mkdirSync(saveDirectory);
    }
}