const { transformSync } = require('@babel/core');
const funParamCheckerPlugin = require('./plugin/fun-param-checker');

const sourceCode = `
    function add(a: number, b: number): number{
        return a + b;
    }
    add(1, '2');
`;

const { code } = transformSync(sourceCode, {
    plugins: [[funParamCheckerPlugin, {
        fix: true
    }]],
    parserOpts: {
        sourceType: 'unambiguous',
        plugins: ['typescript']
    },
    comments: true
});

console.log(code);
