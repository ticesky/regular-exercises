const { transformSync } = require('@babel/core');
const complexTypeCheckerPlugin = require('./plugin/complex-type-checker');

const sourceCode = `
    type Res<Param> = Param extends 1 ? number : string;
    function add<T>(a: T, b: T) {
        return a + b;
    }
    add<Res<1>>(1, '2');
`;

const { code } = transformSync(sourceCode, {
    plugins: [[complexTypeCheckerPlugin, {
        fix: true
    }]],
    parserOpts: { sourceType: 'unambiguous', plugins: ['typescript'] },
    comments: true
});

console.log(code);