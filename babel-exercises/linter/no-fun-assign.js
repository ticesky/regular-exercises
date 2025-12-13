const { transformSync } = require('@babel/core');
const noFunAssignLintPlugin = require('./plugin/no-fun-assign-lint');

const sourceCode = `
    function foo() {
        foo = bar;
    }
    var a = function hello() {
    hello = 123;
    };
`;

const { code } = transformSync(sourceCode, {
    plugins: [noFunAssignLintPlugin],
    parserOpts: {
        sourceType: 'unambiguous',
    },
    filename: 'input.js'
});

console.log(code);
