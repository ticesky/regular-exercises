const { transformSync } = require('@babel/core');
const overrideCheckerPlugin = require('./plugin/override-checker');

const sourceCode = `
class Parent {
  getName() {}
}

class Child extends Parent {
  override getAge() {}
  override getName() {}
}
`

const { code } = transformSync(sourceCode, {
    plugins: [overrideCheckerPlugin],
    parserOpts: {
        plugins: ['typescript'],
        sourceType: 'unambiguous',
    }
});

console.log(code);