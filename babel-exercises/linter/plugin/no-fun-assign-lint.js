/**
 * Babel 禁止函数重赋值规范检测插件
 * 避免因函数变量被意外重赋值导致的逻辑错乱、函数调用失败等 bug
 * 核心功能：
 * 1. 检测代码中对「函数声明/函数表达式」绑定的变量进行重赋值的行为
 * 2. 禁止场景：
 *    - 函数声明变量重赋值：function foo() {}; foo = 123;
 *    - 函数表达式变量重赋值：const bar = function() {}; bar = 456;
 * 3. 检测到违规行为时抛出带代码帧的错误（含行列位置）
 */
const { declare } = require('@babel/helper-plugin-utils');

const noFunAssignLint = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('errors', []);
        },
        visitor: {
            AssignmentExpression(path, state) {
                const errors = state.file.get('errors');

                // ========== 1. 提取赋值目标并解析作用域绑定 ==========
                // 提取赋值表达式左侧的目标字符串（如 foo = 123 中的 foo）
                // 注意：toString() 会将复杂表达式转为代码字符串（如 obj.foo → "obj.foo"）
                const assignTarget = path.get('left').toString();

                // 从当前作用域中获取赋值目标的绑定信息（Binding）
                // Binding 包含变量的声明类型、作用域、是否可重赋值等信息
                const binding = path.scope.getBinding(assignTarget);

                // 无绑定信息时直接返回（如赋值目标是未声明的变量/复杂表达式）
                if (!binding) return;

                // ========== 2. 校验绑定是否为函数类型 ==========
                // 判断绑定的声明节点是否为函数声明/函数表达式
                const isFunctionBinding = 
                    binding.path.isFunctionDeclaration() || // 函数声明（function foo() {}）
                    binding.path.isFunctionExpression();     // 函数表达式（const foo = function() {}）

                // ========== 3. 检测到函数重赋值则抛出错误 ==========
                if (isFunctionBinding) {
                    const tmp = Error.stackTraceLimit;
                    Error.stackTraceLimit = 0;
                    /**
                     * 构建带代码帧的错误信息（定位到赋值表达式节点）
                     * 错误提示：明确禁止函数重赋值的行为
                     */
                    const error = path.buildCodeFrameError(
                        `can not reassign to function variable: "${assignTarget}"`,
                        Error // 错误类型（Babel 封装为 SyntaxError）
                    );
                    errors.push(error); // 将错误添加到缓存列表
                    Error.stackTraceLimit = tmp;
                }
            }
        },
        post(file) {
            console.log(file.get('errors'));
        }
    }
});

module.exports = noFunAssignLint;