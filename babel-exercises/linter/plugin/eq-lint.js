/**
 * Babel 代码规范检测插件：强制替换 ==/!= 为 ===/!==
 * 允许「同类型字面量比较」（如 1 == 2、'a' == 'b'），避免过度检测
 * 禁止「不同类型/非字面量比较」（如 a == 1、'1' == 1），防止隐式类型转换 bug
 * 核心功能：
 * 1. 检测代码中所有 ==/!= 二元表达式，排除「同类型字面量比较」场景
 * 2. 对非安全的 ==/!= 抛出代码帧错误（带位置提示）
 * 3. 支持自动修复：将 == 替换为 ===，!= 替换为 !==
 */
const { declare } = require('@babel/helper-plugin-utils');

const eqLintPlugin = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('errors', []);
        },
        visitor: {
            //  处理二元表达式节点（BinaryExpression）
            //  核心逻辑：检测 ==/!= 操作符，排除安全场景后抛出错误，支持自动修复
            BinaryExpression(path, state) {
                const errors = state.file.get('errors');
                const { operator } = path.node; // 获取二元表达式的操作符（如 ==/!=/+/*）
                if (['==', '!='].includes(operator)) {
                    // 左表达式节点路径（如 a == 1 中的 a）
                    const left = path.get('left');
                    // 右表达式节点路径（如 a == 1 中的 1）
                    const right = path.get('right');
                    if ((left.isLiteral() && right.isLiteral() && typeof left.node.value === typeof right.node.value)) {
                        // 临时关闭堆栈跟踪，减少错误信息冗余
                        const tmp = Error.stackTraceLimit;
                        Error.stackTraceLimit = 0;
                        /**
                         * 构建带代码帧的错误信息（含行列位置）
                         * 示例错误提示：please replace == with ===
                         */
                        const error = path.buildCodeFrameError(
                            `please replace ${operator} with ${operator + '='}`, // 错误提示文本
                            Error // 错误类型（Babel 会封装为 SyntaxError）
                        );
                        // 将错误添加到缓存列表
                        errors.push(error);
                        // 恢复堆栈跟踪限制
                        Error.stackTraceLimit = tmp;
                        // 开启自动修复时：替换操作符（== → ===，!= → !==）
                        if (state.opts.fix) {
                            path.node.operator = path.node.operator + '=';
                        }
                    }
                }
            }
        },
        post(file) {
            console.log(file.get('errors'));
        }
    }
});

module.exports = eqLintPlugin;