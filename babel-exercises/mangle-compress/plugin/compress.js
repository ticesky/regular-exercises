/**
 * Babel 代码压缩优化插件
 * 减少无用代码体积，提升代码执行效率
 * 核心功能：
 * 1. 移除「终止语句（return/throw/break/continue）」后的无效代码
 * 2. 清理未被引用的变量声明：
 *    - 含 PURE 注释的函数调用变量 → 直接移除
 *    - 非纯表达式变量 → 保留表达式执行（移除变量声明）
 *    - 纯表达式变量 → 直接移除
 */
const { declare } = require('@babel/helper-plugin-utils');

/**
 * 判断语句是否允许出现在终止语句（CompletionStatement）之后
 * 规则：仅函数声明/var 变量声明可保留（因变量提升特性，其他语句均为无效代码）
 * @param {import('@babel/traverse').NodePath} path 语句节点路径
 * @returns {boolean} 是否允许保留
 */
function canExistAfterCompletion(path) {
    return path.isFunctionDeclaration() || // 函数声明（变量提升，可保留）
        path.isVariableDeclaration({ kind: "var" }); // var 声明（变量提升，可保留）
}

const compressPlugin = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('uid', 0);
        },
        visitor: {
            BlockStatement(path) {
                // 获取块内所有语句的路径列表（如函数体中的每一行代码）
                const statementPaths = path.get('body');
                // 标记：是否进入「清理模式」（遇到终止语句后为 true）
                let purge = false;
                // 遍历块内所有语句
                for (let i = 0; i < statementPaths.length; i++) {
                    // 1. 遇到终止语句（return/throw/break/continue），开启清理模式
                    if (statementPaths[i].isCompletionStatement()) {
                        purge = true;
                        // 终止语句本身保留，后续语句开始清理
                        continue;
                    }
                    // 2. 清理模式下：非允许保留的语句直接移除
                    if (purge && !canExistAfterCompletion(statementPaths[i])) {
                        // 移除无效代码（如 let/const 声明、表达式语句等）
                        statementPaths[i].remove();
                    }
                }
            },
            Scopable(path) {
                // 遍历当前作用域内的所有变量绑定（key: 变量名，value: 绑定信息）
                Object.entries(path.scope.bindings).forEach(([_, binding]) => {
                    // 仅处理「未被引用」的变量（引用次数为 0）
                    if (!binding.referenced) {
                        // 变量初始化表达式路径
                        const varInitPath = binding.path.get('init');

                        // ========== 规则1：含 PURE 注释的函数调用变量 → 直接移除 ==========
                        // 初始化值是函数调用（如 const a = fn()）
                        if (varInitPath.isCallExpression()) {
                            // 获取函数调用的前置注释
                            const comments = binding.path.get('init').node.leadingComments;
                            // 注释包含 PURE → 标记为纯函数调用，无副作用，可直接移除变量
                            if (comments && comments[0] && comments[0].value.includes('PURE')) {
                                binding.path.remove(); // 移除整个变量声明
                                return; // 跳过后续逻辑
                            }
                        }

                        // ========== 规则2：非纯表达式 → 保留执行，移除变量声明 ==========
                        // isPure：判断表达式是否为「纯表达式」（无副作用，如 1+1；非纯如 console.log()）
                        if (!path.scope.isPure(binding.path.node.init)) {
                            // 将变量声明替换为表达式语句（如 const a = console.log() → console.log()）
                            binding.path.parentPath.replaceWith(api.types.expressionStatement(binding.path.node.init));
                        }
                        // ========== 规则3：纯表达式 → 直接移除变量声明 ========== 
                        else {
                            binding.path.remove();
                        }
                    }
                });
            }
        }
    }
});

module.exports = compressPlugin;