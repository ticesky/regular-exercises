const astDefinitionsMap = new Map(Object.entries({
    'Program': {
        visitor: ['body'],
        isBlock: true
    },
    'VariableDeclaration': {
        visitor: ['declarations']
    },
    'VariableDeclarator': {
        visitor: ['id', 'init']
    },
    'Identifier': {},
    'NumericLiteral': {},
    'FunctionDeclaration': {
        visitor: ['id', 'params', 'body'],
        isBlock: true
    },
    'BlockStatement': {
        visitor: ['body']
    },
    'ReturnStatement': {
        visitor: ['argument']
    },
    'BinaryExpression': {
        visitor: ['left', 'right']
    },
    'ExpressionStatement': {
        visitor: ['expression']
    },
    'CallExpression': {
        visitor: ['callee', 'arguments']
    }
}));


const validations = {};

for (let name of astDefinitionsMap.keys()) {
    validations['is' + name] = function (node) {
        return node.type === name;
    }
}

module.exports = {
    visitorKeys: astDefinitionsMap,
    ...validations
};