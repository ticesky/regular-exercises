const path = require('path');
const { transformFileSync } = require('@babel/core');
const autoTrackPlugin = require('./plugin/auto-track-plugin');

const { code } = transformFileSync(path.join(__dirname, './sourceCode.js'), {
    plugins: [[autoTrackPlugin, {
        trackerPath: 'tracker'
    }]]
});

console.log(code);
