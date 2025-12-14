const acorn = require("acorn");
const { literalExtend, astDefinitionsMap } = require('../../utils');

const Parser = acorn.Parser;
const newParser = Parser.extend(literalExtend);

function traverse(node, visitors) {
    const definition = astDefinitionsMap.get(node.type);

    let visitorFuncs = visitors[node.type] || {};

    if(typeof visitorFuncs === 'function') {
        visitorFuncs = {
            enter: visitorFuncs
        }
    }

    visitorFuncs.enter && visitorFuncs.enter(node);

    if (definition.visitor) {
        definition.visitor.forEach(key => {
            const prop = node[key];
            if (Array.isArray(prop)) { // 如果该属性是数组
                prop.forEach(childNode => {
                    traverse(childNode, visitors);
                })
            } else {
                traverse(prop, visitors);
            }
        })
    }
    visitorFuncs.exit && visitorFuncs.exit(node);
}

const ast = newParser.parse(`
    const a = 1;
`);

traverse(ast, {
    Identifier: {
        enter(node) {
            console.log('enter');
        },
        exit(node) {
            console.log('exit');
            node.name = 'b';
        }
    }
});

console.log(JSON.stringify(ast, null, 2));