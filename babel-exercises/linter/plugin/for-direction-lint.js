/**
 * Babel for 循环方向规范检测插件
 * 避免因循环方向错误导致的死循环/逻辑错误（如 for (let i=0; i<10; i--) ）
 * 核心功能：
 * 1. 检测 for 循环的「条件判断运算符」与「更新运算符」是否匹配，避免循环方向错误
 * 2. 规则：
 *    - 条件为 < / <= 时，更新运算符必须是 ++（递增）
 *    - 条件为 > / >= 时，更新运算符必须是 --（递减）
 * 3. 检测到不匹配时抛出带代码帧的错误（含行列位置）
 **/
const { declare } = require('@babel/helper-plugin-utils');

const forDirectionLintPlugin = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('errors', []);
        },
        visitor: {
            ForStatement(path, state) {
                const errors = state.file.get('errors');
                // ========== 1. 提取 for 循环关键节点的运算符 ==========
                // for 循环条件表达式的运算符（如 for (i=0; i<10; i++) 中的 <）
                const testOperator = path.node.test?.operator
                // for 循环更新表达式的运算符（如 for (i=0; i<10; i++) 中的 ++）
                const updateOperator = path.node.update?.operator;
                // 无有效运算符时直接返回（如 for (;;) 空循环）
                if (!testOperator || !updateOperator) return;

                // ========== 2. 定义运算符匹配规则 ==========
                let shouldUpdateOperator;
                // 条件为 < / <= → 预期更新运算符是 ++（递增）
                if (['<', '<='].includes(testOperator)) {
                    shouldUpdateOperator = '++';
                    // 条件为 > / >= → 预期更新运算符是 --（递减）
                } else if (['>', '>='].includes(testOperator)) {
                    shouldUpdateOperator = '--';
                }

                // ========== 3. 校验运算符是否匹配，不匹配则抛出错误 ==========
                if (shouldUpdateOperator !== updateOperator) {
                    const tmp = Error.stackTraceLimit;
                    Error.stackTraceLimit = 0;
                    /**
                     * 构建带代码帧的错误信息（定位到 update 节点，精准提示）
                     * 错误提示：for direction error（循环方向错误）
                     * 示例错误位置：for (let i=0; i<10; i--) 中的 i-- 位置
                     */
                    const error = path.get('update').buildCodeFrameError(
                        `for direction error: 条件运算符 ${testOperator} 应匹配更新运算符 ${shouldUpdateOperator}，当前为 ${updateOperator}`,
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

module.exports = forDirectionLintPlugin;