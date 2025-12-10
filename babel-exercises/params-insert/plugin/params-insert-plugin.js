/**
 * Babel 控制台日志增强插件
 * 核心功能：
 * 1. 自动为 console.log/info/error/debug 调用注入「文件路径+行列号」前缀日志
 * 2. 区分 JSX 场景与普通场景：
 *    - JSX 内：将日志包装为数组表达式（避免 JSX 语法错误）
 *    - 普通场景：在原日志前插入位置日志
 * 3. 标记新生成的节点，避免无限循环处理
 */
const { declare } = require('@babel/helper-plugin-utils');

/**
 * 目标控制台方法名列表（需增强的 console 方法）
 * 支持：console.log/info/error/debug
 */
const targetCalleeName = ['log', 'info', 'error', 'debug'].map(item => `console.${item}`);

const parametersInsertPlugin = declare((api) => {
    api.assertVersion(7);

    return {
        visitor: {
            /**
             * 处理函数调用表达式节点（CallExpression）
             * 核心逻辑：识别 console 方法调用，注入位置日志
             * @param {import('@babel/traverse').NodePath} path CallExpression 节点路径
             * @param {import('@babel/core').PluginPass} state 插件状态对象（含文件信息）
             */
            CallExpression(path, state) {
                // ========== 1. 跳过新生成的节点，避免无限循环 ==========
                // 标记新生成的 console.log 节点（isNew: true），跳过处理
                if (path.node.isNew) {
                    return;
                }

                // ========== 2. 识别目标 console 方法调用 ==========
                // 获取函数调用名称（如 console.log/console.error）
                const calleeName = path.get('callee').toString();
                // 仅处理目标 console 方法
                if (!targetCalleeName.includes(calleeName)) {
                    return;
                }

                // ========== 3. 获取当前代码位置（行列号） ==========
                // 容错：loc 节点不存在时（如动态生成的 AST），使用默认值
                const { line = 'unknown', column = 'unknown' } = path.node.loc?.start || {};
                // 构建位置日志内容（文件名 + 行列号）
                const locationInfo = `${state.filename || 'unknown filename'}: (${line}, ${column})`;

                // ========== 4. 生成位置日志节点 ==========
                // 使用 template 构建 console.log 表达式节点，避免手动拼接 AST
                const newNode = api.template.expression(`console.log("${locationInfo}")`)();
                // 标记新节点，防止递归处理
                newNode.isNew = true;

                // ========== 5. 区分 JSX/普通场景注入节点 ==========
                // 场景1：JSX 元素内（如 <div>{console.log(1)}</div>）
                if (path.findParent(path => path.isJSXElement())) {
                    // 包装为数组表达式（避免 JSX 中多个表达式报错）
                    path.replaceWith(api.types.arrayExpression([newNode, path.node]));
                    // 跳过当前节点的后续遍历，提升性能
                    path.skip();
                } 
                // 普通代码中（如函数/块级作用域内）
                else {
                    // 在原 console 调用前插入位置日志节点
                    path.insertBefore(newNode);
                }
            }
        }
    }
})

module.exports = parametersInsertPlugin;