const path = require('path');
const { transformFileSync } = require('@babel/core');
const autoI18nPlugin = require('./plugin/auto-i18n-plugin');

// const sourceCode = fs.readFileSync(path.join(__dirname, './sourceCode.js'), {
//     encoding: 'utf-8'
// });

// const ast = parser.parse(sourceCode, {
//     sourceType: 'unambiguous',
//     plugins: ['jsx']
// });

// const { code } = transformFileSync(ast, sourceCode, {
//     plugins: [[autoI18nPlugin, {
//         outputDir: path.resolve(__dirname, './output')
//     }]]
// });

const { code } = transformFileSync(path.join(__dirname, './sourceCode.js'), {
    plugins: [[autoI18nPlugin, {
        outputDir: path.resolve(__dirname, './output')
    }]],
    parserOpts: {
        sourceType: 'unambiguous',
        plugins: ['jsx']
    }
})

console.log(code);
