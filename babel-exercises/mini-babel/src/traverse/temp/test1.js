const acorn = require("acorn");
const { literalExtend, astDefinitionsMap } = require('../../utils');

const Parser = acorn.Parser;
const newParser = Parser.extend(literalExtend);

function traverse(node) {
    const definition = astDefinitionsMap.get(node.type);

    console.log(node.type);

    if (definition.visitor) {
        definition.visitor.forEach(key => {
            const prop = node[key];
            if (Array.isArray(prop)) { // 如果该属性是数组
                prop.forEach(childNode => {
                    traverse(childNode);
                })
            } else {
                traverse(prop);
            }
        })
    }
}

const ast = newParser.parse(`
    const a = 1;
`, { ecmaVersion: 6 });

traverse(ast)