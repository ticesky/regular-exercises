const { transformSync } = require('@babel/core');
const eqLintPlugin = require('./plugin/eq-lint');

const sourceCode = `
// const four = /* foo */ add(2, 2);
// a == b;
// foo == true
// bananas != 1;
// value == undefined
// typeof foo == 'undefined'
// 'hello' != 'world';
// 0 == 0
true == true
`;

const { code } = transformSync(sourceCode, {
    plugins: [[eqLintPlugin, {
        fix: true
    }]],
    parserOpts: {
        sourceType: 'unambiguous',
    },
    comments: true
});

console.log(code);

// todo
// 1. comments 作用
