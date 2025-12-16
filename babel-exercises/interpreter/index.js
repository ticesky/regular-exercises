/**
 * @file AST 解释器 - 解析并执行 JavaScript 代码的 AST 节点
 * @description 基于 @babel/parser 生成的 AST 构建简易解释器，支持变量声明、函数声明/调用、表达式计算等基础功能
 */
const parser = require('@babel/parser');
const { codeFrameColumns } = require('@babel/code-frame');
const chalk = require('chalk');

const sourceCode = `
   const  a = 2;
   function add(a, b) {
    return a + b;
   }
   console.log(add(1, 2));
`;

const ast = parser.parse(sourceCode, {
    sourceType: 'unambiguous'
});

class Scope {
    constructor(parentScope) {
        this.parent = parentScope;
        // 当前作用域的变量映射表
        this.declarations = [];
    }

    set(name, value) {
        this.declarations[name] = value;
    }

    getLocal(name) {
        return this.declarations[name];
    }

    get(name) {
        let res = this.getLocal(name);
        if (res === undefined && this.parent) {
            res = this.parent.get(name);
        }
        return res;
    }

    has(name) {
        return !!this.getLocal(name);
    }
}

const evaluator = (function () {
    /**
     * 获取标识符节点的值（递归解析）
     * @param {import('@babel/types').Node} node - AST 节点
     * @param {Scope} scope - 当前作用域
     * @returns {any} 解析后的值
     */
    function getIdentifierValue(node, scope) {
        if (node.type === 'Identifier') {
            return scope.get(node.name);
        } else {
            return evaluate(node, scope);
        }
    }
    /**
     * AST 节点解析器映射表 - 不同类型节点的处理函数
     * @type {Record<string, (node: import('@babel/types').Node, scope: Scope) => any>}
     */
    const astInterpreters = {
        Program(node, scope) {
            node.body.forEach(item => {
                evaluate(item, scope);
            })
        },
        VariableDeclaration(node, scope) {
            node.declarations.forEach((item) => {
                evaluate(item, scope);
            });
        },
        VariableDeclarator(node, scope) {
            const declareName = evaluate(node.id);
            if (scope.get(declareName)) {
                throw Error('duplicate declare variable：' + declareName);
            } else {
                scope.set(declareName, evaluate(node.init, scope));
            }
        },
        ExpressionStatement(node, scope) {
            return evaluate(node.expression, scope);
        },
        MemberExpression(node, scope) {
            const obj = scope.get(evaluate(node.object));
            return obj[evaluate(node.property)]
        },
        FunctionDeclaration(node, scope) {
            const declareName = evaluate(node.id);
            if (scope.get(declareName)) {
                throw Error('duplicate declare variable：' + declareName);
            } else {
                // 创建函数
                const func = function (...args) {
                    // 创建函数作用域，继承父作用域
                    const funcScope = new Scope(scope);
                    // 处理函数参数
                    node.params.forEach((param, index) => {
                        const paramName = evaluate(param, funcScope);
                        funcScope.set(paramName, args[index]);
                    });
                    // 设置 this 上下文
                    funcScope.set('this', this);
                    // 执行函数体并返回结果
                    return evaluate(node.body, funcScope);
                };
                // 将函数存入当前作用域
                scope.set(declareName, func);
                return func;
            }
        },
        ReturnStatement(node, scope) {
            return evaluate(node.argument, scope);
        },
        BlockStatement(node, scope) {
            for (let i = 0; i < node.body.length; i++) {
                const result = evaluate(node.body[i], scope);
                if (node.body[i].type === 'ReturnStatement') {
                    return result;
                }
            }
        },
        CallExpression(node, scope) {
            const args = node.arguments.map(node => getIdentifierValue(node, scope))
            if (node.callee.type === 'MemberExpression') {
                const fn = evaluate(node.callee, scope);
                const obj = evaluate(node.callee.object, scope);
                return fn.apply(obj, args);
            } else {
                const fn = scope.get(evaluate(node.callee, scope));
                return fn.apply(null, args);
            }
        },
        BinaryExpression(node, scope) {
            const leftValue = getIdentifierValue(node.left, scope);
            const rightValue = getIdentifierValue(node.right, scope);
            switch (node.operator) {
                case '+':
                    return leftValue + rightValue;
                case '-':
                    return leftValue - rightValue;
                case '*':
                    return leftValue * rightValue;
                case '/':
                    return leftValue / rightValue;
                default:
                    throw Error('upsupported operator：' + node.operator);
            }
        },
        Identifier(node) {
            return node.name;
        },
        NumericLiteral(node) {
            return node.value;
        }
    }

    const evaluate = (node, scope) => {
        try {
            const interpreter = astInterpreters[node.type];
            if (!interpreter) {
                throw new Error(`astInterpreters[${node.type}] is not a function`);
            }
            return interpreter(node, scope);
        } catch (e) {
            if (e && e.message && e.message.indexOf('astInterpreters[node.type] is not a function') != -1) {
                console.error('unsupported ast type: ' + node.type);
                console.error(codeFrameColumns(sourceCode, node.loc, {
                    highlightCode: true
                }));
            } else {
                console.error(node.type + ':', e.message);
                if (node.loc) {
                    console.error(codeFrameColumns(sourceCode, node.loc, {
                        highlightCode: true
                    }));
                }
            }
        }
    }
    return {
        evaluate
    }
})();

const globalScope = new Scope();
globalScope.set('console', {
    log: function (...args) {
        console.log(chalk.green(...args));
    },
    error: function (...args) {
        console.log(chalk.red(...args));
    },
    error: function (...args) {
        console.log(chalk.orange(...args));
    },
});
evaluator.evaluate(ast.program, globalScope);

// console.log(globalScope);