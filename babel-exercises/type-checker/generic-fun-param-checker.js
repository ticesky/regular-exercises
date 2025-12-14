const { transformSync } = require('@babel/core');
const genericCheckerPlugin = require('./plugin/generic-fun-param-checker');

const sourceCode = `
    function add<T>(a: T, b: T) {
        return a + b;
    }
    add<number>(1, '2');
`;

const { code } = transformSync(sourceCode, {
    plugins: [[genericCheckerPlugin, {
        fix: true
    }]],
    parserOpts: {
        sourceType: 'unambiguous',
        plugins: ['typescript']
    },
    comments: true
});

console.log(code);
