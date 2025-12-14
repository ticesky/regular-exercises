/**
 * Babel 函数调用参数类型一致性校验插件
 * TypeScript 类型体系下的函数调用校验，避免参数类型不匹配导致的运行时错误
 * 核心功能：
 * 1. 校验函数调用时「实参类型注解」与函数声明时「形参类型注解」是否一一匹配
 * 2. 支持 TS 类型注解（TSStringKeyword/TSNumberKeyword）和 Flow 类型注解（NumberTypeAnnotation/StringTypeAnnotation）
 * 3. 类型不匹配时抛出带代码帧的语义错误，且屏蔽冗余堆栈信息
 * 4. 支持多参数逐位校验，精准定位错误参数位置
 */
const { declare } = require('@babel/helper-plugin-utils');
const { resolveType, noStackTraceWrapper } = require('./utils')

const noFuncAssignLint = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('errors', []);
        },
        visitor: {
            CallExpression(path, state) {
                const errors = state.file.get('errors');

                // ========== 1. 提取函数调用的实参类型列表 ==========
                // 遍历所有实参，解析每个参数的类型注解
                const argumentsTypes = path.get('arguments').map(item => {
                    return resolveType(item.getTypeAnnotation());
                });
                // ========== 2. 定位函数声明节点，提取形参类型列表 ==========
                // 获取函数调用的名称（如 fn(1,2) 中的 fn）
                const calleeName = path.get('callee').toString();
                // 从当前作用域获取函数名称的绑定（找到函数声明节点）
                const functionBinding = path.scope.getBinding(calleeName);
                // 容错：函数未声明（如调用未定义的函数），跳过校验
                if (!functionBinding) return;
                const functionDeclarePath = functionBinding.path; // 函数声明节点路径
                // 遍历函数声明的形参，解析每个参数的类型注解
                const declareParamsTypes = functionDeclarePath.get('params').map(item => {
                    return resolveType(item.getTypeAnnotation());
                })

                // ========== 3. 逐位校验实参类型与形参类型 ==========
                argumentsTypes.forEach((argType, index) => {
                    const paramType = declareParamsTypes[index];

                    if (argType && paramType && argType !== paramType) {
                        // 执行无堆栈的错误创建逻辑，精准定位错误参数位置
                        noStackTraceWrapper(Error => {
                            const errorMessage = `${argType} can not assign to ${paramType}`;
                            // 构建带代码帧的错误（定位到具体错误参数位置）
                            errors.push(path.get(`arguments.${index}`).buildCodeFrameError(errorMessage, Error));
                        });
                    }
                });
            }
        },
        post(file) {
            console.log(file.get('errors'));
        }
    }
});

module.exports = noFuncAssignLint;