/**
 * Babel 自动国际化（i18n）插件
 * 核心功能：
 * 1. 自动检测/导入 intl 国际化模块，避免重复导入
 * 2. 提取代码中的字符串字面量/模板字符串，生成唯一国际化 key
 * 3. 将原字符串替换为 intl.t(key) 调用（兼容 JSX 场景的表达式容器）
 * 4. 自动生成多语言配置文件（zh_CN.js/en_US.js），包含所有提取的字符串
 * 5. 支持跳过标记（i18n-disable 注释），排除无需国际化的字符串
 * 
 * 适用场景：前端项目国际化改造，自动替换硬编码字符串为国际化调用，生成多语言配置
 */
const { declare } = require('@babel/helper-plugin-utils');
const fse = require('fs-extra');
const path = require('path');
const generate = require('@babel/generator').default;

let intlIndex = 0;

// 生成下一个唯一的国际化Key，如intl1、intl2的唯一Key
function nextIntlKey() {
    ++intlIndex;
    return `intl${intlIndex}`;
}

const autoI18nPlugin = declare((api, options) => {
    api.assertVersion(7);

    if (!options.outputDir) {
        throw new Error('outputDir in empty');
    }

    /**
     * 生成替换后的国际化调用AST节点
     * @param {import('@babel/traverse').NodePath} path - 当前AST节点路径
     * @param {string} value - 国际化Key值
     * @param {string} intlUid - 自动注入的intl模块变量名（如_intl）
     * @returns {import('@babel/types').Expression|import('@babel/types').JSXExpressionContainer} 替换后的AST节点
     */
    function getReplaceExpression(path, value, intlUid) {
        // 解析模板字符串的表达式参数（如 `hello ${name}` → [name]）
        const expressionParams = path.isTemplateLiteral()
            ? path.node.expressions.map(item => generate(item).code)
            : null
        // 生成intl.t('key', ...参数)的AST节点
        let replaceExpression = api.template.ast(
            `${intlUid}.t('${value}'${expressionParams ? ',' + expressionParams.join(',') : ''})`
        ).expression;
        // 场景：JSX 属性内的字符串（非表达式容器）→ 包装为 JSXExpressionContainer
        // 如 <div>hello</div> → <div>{intl.t('intl1')}</div>
        if (path.findParent(p => p.isJSXAttribute()) && !path.findParent(p => p.isJSXExpressionContainer())) {
            replaceExpression = api.types.JSXExpressionContainer(replaceExpression);
        }
        // 普通场景：直接返回 intl.t 调用表达式
        return replaceExpression;
    }

    /**
     * 暂存国际化Key-Value到文件上下文
     * @param {import('@babel/core').File} file - Babel文件对象
     * @param {string} key - 国际化唯一Key
     * @param {string} value - 原始字符串值
     */
    function save(file, key, value) {
        const allText = file.get('allText');
        allText.push({
            key, value
        });
        file.set('allText', allText);
    }

    return {
        pre(file) {
            file.set('allText', []);
        },
        visitor: {
            /**
             * 处理 Program 根节点（整个文件的入口节点）
             * 核心逻辑：
             * 1. 检测是否已导入 intl 模块 → 未导入则自动添加
             * 2. 标记需跳过国际化的字符串（i18n-disable 注释/导入语句内的字符串）
             */
            Program(path, state) {
                // ========== 步骤1：检测/导入 intl 模块 ==========
                let imported = false;
                path.traverse({
                    /**
                     * 遍历 ImportDeclaration 节点，查找 intl 模块导入
                     * @param {import('@babel/traverse').NodePath} p ImportDeclaration 节点路径
                     */
                    ImportDeclaration(p) {
                        const source = p.node.source.value;
                        if (source === 'intl') {
                            imported = true;
                            // 提取 intl 模块的本地变量名（如 import intl from 'intl' → intl）
                            const specifier = p.node.specifiers[0];
                            if (specifier) {
                                state.intlUid = specifier.local.name;
                            }
                            p.stop(); // 找到后停止遍历，提升性能
                        }
                    }
                });

                // 未导入 intl 模块 → 自动添加默认导入（生成唯一变量名避免冲突）
                if (!imported) {
                    const uid = path.scope.generateUid('intl');
                    const importAst = api.template.ast(`import ${uid} from 'intl'`);
                    path.node.body.unshift(importAst);
                    state.intlUid = uid;
                }

                // ========== 步骤2：标记需跳过的字符串 ==========
                path.traverse({
                    'StringLiteral|TemplateLiteral'(path) {
                        // 场景1：包含 i18n-disable 注释 → 标记跳过
                        if (path.node.leadingComments) {
                            path.node.leadingComments = path.node.leadingComments.filter((comment) => {
                                if (comment.value.includes('i18n-disable')) {
                                    path.node.skipTransform = true;
                                    return false;
                                }
                                return true;
                            })
                        }
                        // 场景2：导入语句内的字符串（如 import 'react'）→ 标记跳过
                        if (path.findParent(p => p.isImportDeclaration())) {
                            path.node.skipTransform = true;
                        }
                    }
                });
            },
            /**
             * 处理字符串字面量节点（StringLiteral）
             * 核心逻辑：提取字符串 → 生成 key → 替换为 intl.t(key) 调用
             * @param {import('@babel/traverse').NodePath} path StringLiteral 节点路径
             * @param {import('@babel/core').PluginPass} state 插件状态对象
             */
            StringLiteral(path, state) {
                // 跳过标记的节点（i18n-disable/导入语句内）
                if (path.node.skipTransform) {
                    return;
                }
                // 生成唯一国际化 key
                let key = nextIntlKey();
                // 保存 key-原始值 映射到文件缓存
                save(state.file, key, path.node.value);
                // 生成替换表达式（intl.t(key)）
                const replaceExpression = getReplaceExpression(path, key, state.intlUid);
                // 替换原字符串节点为国际化调用
                path.replaceWith(replaceExpression);
                // 跳过当前节点的后续遍历，提升性能
                path.skip();
            },
            /**
             * 处理模板字符串节点（TemplateLiteral）
             * 核心逻辑：提取模板字符串 → 生成 key → 替换为 intl.t(key, ...params) 调用
             * @param {import('@babel/traverse').NodePath} path TemplateLiteral 节点路径
             * @param {import('@babel/core').PluginPass} state 插件状态对象
             */
            TemplateLiteral(path, state) {
                if (path.node.skipTransform) {
                    return;
                }
                // 提取模板字符串的原始文本（替换表达式为 {placeholder}）
                // 如 `hello ${name}` → 'hello {placeholder}'
                const value = path.get('quasis').map(item => item.node.value.raw).join('{placeholder}');
                // 非空模板字符串才处理
                if (value) {
                    let key = nextIntlKey();
                    save(state.file, key, value);
                    // 生成替换表达式（intl.t(key, ...params)）
                    const replaceExpression = getReplaceExpression(path, key, state.intlUid);
                    path.replaceWith(replaceExpression);
                    path.skip();
                }
            },
        },
        post(file) {
            const allText = file.get('allText');
            // 转换为 { intl1: 'hello', intl2: 'world' } 格式
            const intlData = allText.reduce((obj, item) => {
                obj[item.key] = item.value;
                return obj;
            }, {});
            // 构建多语言文件内容（ESModule 导出）
            const content = `const resource = ${JSON.stringify(intlData, null, 4)};\nexport default resource;`;
            // 确保输出目录存在（不存在则创建）
            fse.ensureDirSync(options.outputDir);
            fse.writeFileSync(path.join(options.outputDir, 'zh_CN.js'), content);
            fse.writeFileSync(path.join(options.outputDir, 'en_US.js'), content);
        }
    }
});
module.exports = autoI18nPlugin;