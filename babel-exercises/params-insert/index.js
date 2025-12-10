/**
 * Babel 控制台日志增强
 * 核心功能：
 * 自动为 console.log/info/error/debug 调用注入「文件路径+行列号」前缀日志
 */
const path = require('path');
const { transformFileSync } = require('@babel/core');
const insertParametersPlugin = require('./plugin/params-insert-plugin');

const { code } = transformFileSync(path.join(__dirname, './sourceCode.js'), {
    plugins: [insertParametersPlugin],
    parserOpts: {
        sourceType: 'unambiguous',
        plugins: ['jsx']       
    }
});

console.log(code);