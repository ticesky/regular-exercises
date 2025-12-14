const { transformSync } = require('@babel/core');
const varAssignCheckPlugin = require('./plugin/var-assign-checker');

const sourceCode = `
    let name: string = 111;
`;

const { code } = transformSync(sourceCode, {
    plugins: [[varAssignCheckPlugin, {
        fix: true
    }]],
    parserOpts: {
        sourceType: 'unambiguous',
        plugins: ['typescript']
    },
    comments: true
});

console.log(code);
