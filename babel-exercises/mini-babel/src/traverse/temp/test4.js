const acorn = require("acorn");
const { literalExtend, astDefinitionsMap } = require('../../utils');

const Parser = acorn.Parser;
const newParser = Parser.extend(literalExtend);

class NodePath {
    constructor(node, parent, parentPath) {
        this.node = node;
        this.parent = parent;
        this.parentPath = parentPath;
    }
}

function traverse(node, visitors, parent, parentPath) {
    const definition = astDefinitionsMap.get(node.type);

    let visitorFuncs = visitors[node.type] || {};

    if (typeof visitorFuncs === 'function') {
        visitorFuncs = {
            enter: visitorFuncs
        }
    }
    const path = new NodePath(node, parent, parentPath);

    visitorFuncs.enter && visitorFuncs.enter(path);

    if (definition.visitor) {
        definition.visitor.forEach(key => {
            const prop = node[key];
            if (Array.isArray(prop)) { // 如果该属性是数组
                prop.forEach(childNode => {
                    traverse(childNode, visitors, node, path);
                })
            } else {
                traverse(prop, visitors, node, path);
            }
        })
    }
    visitorFuncs.exit && visitorFuncs.exit(path);
}

const ast = newParser.parse(`
    const a = 1;
`, { ecmaVersion: 2020 });

traverse(ast, {
    Identifier: {
        exit(path) {
            path.node.name = 'b';
            let curPath = path;
            while (curPath) {
                console.log(curPath.node.type);
                curPath = curPath.parentPath;
            }
        }
    }
});

// console.log(JSON.stringify(ast, null, 2));