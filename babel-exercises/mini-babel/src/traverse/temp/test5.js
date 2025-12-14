const acorn = require("acorn");
const {literalExtend, astDefinitionsMap} = require('../../utils');

const Parser = acorn.Parser;
const newParser = Parser.extend(literalExtend);

class NodePath {
    constructor(node, parent, parentPath, key, listKey) {
        this.node = node;
        this.parent = parent;
        this.parentPath = parentPath;
        this.key = key;
        this.listKey = listKey;
    }
    replaceWith(node) {
        if (this.listKey) {
            this.parent[this.key].splice(this.listKey, 1, node);
        }
        this.parent[this.key] = node
    }
    remove () {
        if (this.listKey) {
            this.parent[this.key].splice(this.listKey, 1);
        }
        this.parent[this.key] = null;
    }
}

function traverse(node, visitors, parent, parentPath, key, listKey) {
    const definition = astDefinitionsMap.get(node.type);

    let visitorFuncs = visitors[node.type] || {};

    if(typeof visitorFuncs === 'function') {
        visitorFuncs = {
            enter: visitorFuncs
        }
    }
    const path = new NodePath(node, parent, parentPath, key, listKey);

    visitorFuncs.enter && visitorFuncs.enter(path);

    if (definition.visitor) {
        definition.visitor.forEach(key => {
            const prop = node[key];
            if (Array.isArray(prop)) { // 如果该属性是数组
                prop.forEach((childNode, index) => {
                    traverse(childNode, visitors, node, path, key, index);
                })
            } else {
                traverse(prop, visitors, node, path, key);
            }
        })
    }
    visitorFuncs.exit && visitorFuncs.exit(path);
}

const ast = newParser.parse(`
    const a = 1;
`, { ecmaVersion: 2020 });

traverse(ast, {
    NumericLiteral(path) {
        path.replaceWith({ type: 'Identifier', name: 'bbbbbbb' });
    }
});
console.log(JSON.stringify(ast, null, 2));