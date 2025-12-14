const astDefinitionsMap = new Map(Object.entries({
    'Program': {
        visitor: ['body']
    },
    'VariableDeclaration': {
        visitor: ['declarations']
    },
    'VariableDeclarator': {
        visitor: ['id', 'init']
    },
    'Identifier': {},
    'NumericLiteral': {}
}));

const literalExtend = function (Parser) {
    return class extends Parser {
        parseLiteral(...args) {
            const node = super.parseLiteral(...args);
            switch (typeof node.value) {
                case 'number':
                    node.type = 'NumericLiteral';
                    break;
                case 'string':
                    node.type = 'StringLiteral';
                    break;
            }
            return node;
        }
    }
}

module.exports = {
    literalExtend,
    astDefinitionsMap
};