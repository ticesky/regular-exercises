const acorn = require("acorn");
const { literalExtend, astDefinitionsMap } = require('../../utils');

const Parser = acorn.Parser;
const newParser = Parser.extend(literalExtend);

function traverse(node, visitors) {
    const definition = astDefinitionsMap.get(node.type);

    const visitorFunc = visitors[node.type];

    if(visitorFunc && typeof visitorFunc === 'function') {
        visitorFunc(node);
    }

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
}

const ast = newParser.parse(`
    const a = 1;
`, { ecmaVersion: 2020 });

traverse(ast, {
    Identifier: {
        enter(node) {
            console.log('enter', node);
        },
        exit(node) {
            console.log('exit');
            node.name = 'b';
        }
    }
});

console.log(JSON.stringify(ast, null, 2));