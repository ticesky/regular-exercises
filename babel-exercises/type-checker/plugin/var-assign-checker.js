/**
 * Babel 变量类型赋值合法性校验插件
 * TypeScript 类型体系下的赋值类型校验，避免类型不匹配错误
 * 核心功能：
 * 1. 校验变量声明时「变量类型注解」与「初始化值类型注解」是否一致
 * 2. 支持 TS 类型注解（如 TSStringKeyword）和原生类型注解（如 NumberTypeAnnotation）
 * 3. 类型不匹配时抛出带代码帧的语义错误，且屏蔽冗余堆栈信息
 */
const { declare } = require('@babel/helper-plugin-utils');
const { resolveType, noStackTraceWrapper } = require('./utils');

const varAssignCheckPlugin = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('errors', []);
        },
        visitor: {
            VariableDeclarator(path, state) {
                const errors = state.file.get('errors');

                // ========== 1. 解析变量标识符和初始化值的类型 ==========
                // 解析变量名的类型注解（如 const a: string → string）
                const idType = resolveType(path.get('id').getTypeAnnotation());
                // 解析初始化值的类型注解（如 const a: string = 123 → number）
                const initType = resolveType(path.get('init').getTypeAnnotation());

                // ========== 2. 类型不匹配且均为有效类型 → 抛出错误 ==========
                if (idType && initType && idType !== initType) {
                    // 执行无堆栈的错误创建逻辑
                    noStackTraceWrapper((Error) => {
                        // 构建带代码帧的错误（定位到初始化值位置，精准提示）
                        const errorMessage = `${initType} can not assign to ${idType}`;
                        errors.push(path.get('init').buildCodeFrameError(errorMessage, Error));
                    })
                }
            }
        },
        post(file) {
            console.log(file.get('errors'));
        }
    }
});

module.exports = varAssignCheckPlugin;