const MRZDetection = require('../../run/fullMRZDetection');

describe('real passport test', () => {
    it('main test wih real passports', async () => {
        const rootDir = '..';
        const name = 'real';
        const paths = {
            rootDir: rootDir,
            readPath: rootDir + `/data/${name}/`,
            saveMask: rootDir + '/mask/',
            saveMRZ: rootDir + '/mrz/',
            saveHTMLFile: `${name}.html`
        };

        await MRZDetection(paths).then((output) => {
            var stats = output.stats;
            var keys = Object.keys(stats);
            for(var i = 0; i < keys.length; ++i) {
                var elem = keys[i];
                if(elem === 'M') {
                    expect(stats[elem].count).toBe(1);
                } else {
                    expect(stats[elem].count).toBe(0);
                }
            }
        });
    });
});
