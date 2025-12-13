const path = require('path');
const { transformFileSync } = require('@babel/core');
const autoDocumentPlugin = require('./plugin/auto-document-plugin');

const { code } = transformFileSync(path.join(__dirname, './sourceCode.ts'), {
    plugins: [[autoDocumentPlugin, {
        outputDir: path.resolve(__dirname, './docs'),
        format: 'markdown' // markdown/ html / json
    }]],
    parserOpts: {
        sourceType: 'unambiguous',
        plugins: ['typescript']
    }
});

console.log(code);

//todo
// 1. flatMap 与map区别
// 2. 如何只取前面和当前末尾行的注释
