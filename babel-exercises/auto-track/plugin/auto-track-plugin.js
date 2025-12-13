/**
 * Babel 自动埋点插件
 * 核心功能：
 * 1. 自动检测/导入埋点模块（tracker），避免重复导入
 * 2. 为所有函数（类方法/箭头函数/函数表达式/函数声明）注入埋点调用
 * 3. 兼容不同函数体类型（块语句/表达式），保证语法正确性
 * 
 * 适用场景：前端埋点统计，自动为所有函数添加调用追踪，无需手动编写埋点代码
 */
const { declare } = require('@babel/helper-plugin-utils'); // Babel 插件声明辅助函数
const importModule = require('@babel/helper-module-imports'); // 模块导入辅助工具

const autoTrackPlugin = declare((api, options) => {
    // 断言 Babel 版本为 7.x，避免版本不兼容导致异常
    api.assertVersion(7);

    return {
        /**
         * 访问者模式：遍历 AST 节点，处理模块导入 + 函数埋点注入
         */
        visitor: {
            /**
             * 处理 Program 根节点（整个文件的入口节点）
             * 核心逻辑：检测已导入的埋点模块 → 未导入则自动添加默认导入
             * @param {import('@babel/traverse').NodePath} path Program 节点路径
             * @param {import('@babel/core').PluginPass} state 插件状态对象（存储埋点模块 ID）
             */
            Program(path, state) {
                // ========== 步骤1：检测是否已导入埋点模块 ==========
                path.traverse({
                    ImportDeclaration(curPath) {
                        // 获取导入模块的路径（如 import tracker from 'tracker' → 'tracker'）
                        const requirePath = curPath.get('source').node.value;
                        // 匹配配置的埋点模块路径
                        if (requirePath === options.trackerPath) {
                            // 获取import后符号（如 import { track } from 'tracker' → track）
                            const specifierPath = curPath.get('specifiers.0');

                            // 场景1：具名导入（import { track } from 'tracker'）
                            if (specifierPath.isImportSpecifier()) {
                                state.trackerImportId = specifierPath.toString();
                                // 场景2：命名空间导入（import * as tracker from 'tracker'）
                            } else if (specifierPath.isImportNamespaceSpecifier()) {
                                state.trackerImportId = specifierPath.get('local').toString();
                            }
                            // 找到后停止遍历，提升性能
                            curPath.stop();
                        }
                    }
                });
                // ========== 步骤2：未导入埋点模块 → 自动添加默认导入 ==========
                if (!state.trackerImportId) {
                    // 自动添加默认导入：import tracker_123 from 'tracker'（生成唯一名称避免冲突）
                    state.trackerImportId = importModule.addDefault(
                        path, // Program 节点路径（导入语句插入到文件顶部）
                        options.trackerPath || 'tracker', // 埋点模块路径
                        {
                            // 生成唯一名称（如 tracker_123），避免变量名冲突
                            nameHint: path.scope.generateUid('tracker')
                        }).name; // 获取生成的导入变量名
                }
            },
            /**
             * 处理所有函数类型节点：为函数注入埋点调用
             * 支持类型：ClassMethod（类方法）、ArrowFunctionExpression（箭头函数）、FunctionExpression（函数表达式）、FunctionDeclaration（函数声明）
             * @param {import('@babel/traverse').NodePath} path 函数节点路径
             * @param {import('@babel/core').PluginPass} state 插件状态对象（存储埋点模块 ID）
             */
            'ClassMethod|ArrowFunctionExpression|FunctionExpression|FunctionDeclaration'(path, state) {
                // 获取函数体节点路径（如 function() { ... } 中的 {} 节点）
                const bodyPath = path.get('body');
                // ========== 场景1：函数体是块语句（{ ... }） ==========
                if (bodyPath.isBlockStatement()) {
                    // 生成埋点调用语句节点（如 tracker_123()）
                    const newNode = api.template.statement(`${state.trackerImportId}()`)();
                    // 将埋点语句插入到函数体最顶部（优先执行）
                    bodyPath.node.body.unshift(newNode);
                    // ========== 场景2：函数体是表达式（如箭头函数 () => 123） ==========
                } else {
                    // 包装为块语句：{ tracker_123(); return 原表达式; }
                    // 保证语法正确性，同时执行埋点调用
                    const ast = api.template.statement(`{${state.trackerImportId}();return PRE_BODY;}`)({
                        PRE_BODY: bodyPath.node // 替换占位符为原表达式
                    });
                    // 替换原表达式函数体为包装后的块语句
                    bodyPath.replaceWith(ast);
                }
            }
        }
    }
});

module.exports = autoTrackPlugin;