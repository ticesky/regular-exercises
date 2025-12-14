/**
 * Babel 泛型函数调用参数类型一致性校验插件（扩展版）
 * TypeScript 泛型函数调用的类型校验，解决泛型参数类型不匹配问题
 * 核心功能：
 * 1. 支持 TS 泛型函数的类型参数解析（如 fn<string, number>(1, '2')）
 * 2. 校验泛型函数调用时「实参类型」与「泛型绑定后的形参类型」是否匹配
 * 3. 支持基础类型（string/number）和自定义泛型类型（如 T/U）的映射校验
 * 4. 类型不匹配时抛出带代码帧的语义错误，屏蔽冗余堆栈信息
 */
const { declare } = require('@babel/helper-plugin-utils');
const { resolveType, noStackTraceWrapper } = require('./utils')

/**
 * 解析 TypeScript 类型注解，转换为可读的类型字符串
 * 目前支持：string/number/boolean 基础类型，可扩展更多类型
 * @param {import('@babel/types').TSType|import('@babel/types').FlowType} targetType AST 中的类型注解节点
 * @param {Object} [referenceTypesMap={}] 泛型类型映射表（如 { T: 'string', U: 'number' }）
 * @returns {string|undefined} 简化后的类型字符串（如 'string'），无类型注解则返回 undefined
 */
function resolveRealType(targetType, referenceTypesMap = {}) {
    if(targetType.type === 'TSTypeReference'){
        return referenceTypesMap[targetType.typeName.name]
    }
    return resolveType(targetType)
}

const noFuncAssignLint = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('errors', []);
        },
        visitor: {
            CallExpression(path, state) {
                const errors = state.file.get('errors');

                // ========== 步骤1：解析函数调用的泛型类型参数（如 fn<T,U>(1,2) 中的 T/U 实际类型） ==========
                // 空值容错：无泛型类型参数时返回空数组
                const genericTypeParams = path.node.typeParameters?.params || [];
                // 解析泛型类型参数为实际类型（如 [TSStringKeyword, TSNumberKeyword] → ['string', 'number']）
                const realTypes = genericTypeParams.map(item => resolveType(item));

                // ========== 步骤2：解析函数调用的实参类型列表 ==========
                // 遍历所有实参，解析每个参数的类型注解（基础类型）
                const argumentsTypes = path.get('arguments').map(item => {
                    return resolveType(item.getTypeAnnotation());
                });

                // ========== 步骤3：定位函数声明节点，构建泛型类型映射表 ==========
                // 获取函数调用名称（如 fn<T>(1) 中的 fn）
                const calleeName = path.get('callee').toString();
                // 从当前作用域获取函数绑定（找到函数声明节点）
                const functionBinding = path.scope.getBinding(calleeName);
                if (!functionBinding) return;
                const functionDeclarePath = functionBinding.path; // 泛型函数声明节点路径
                // 构建泛型类型映射表（如泛型参数 T → 实际类型 string）
                const realTypeMap = {};
                // 空值容错：函数声明无泛型参数时跳过映射
                const declareGenericParams = functionDeclarePath.node.typeParameters?.params || [];
                declareGenericParams.forEach((item, index) => {
                    // 泛型参数名 → 实际类型（如 T → string）
                    realTypeMap[item.name] = realTypes[index];
                });

                // ========== 步骤4：解析泛型绑定后的形参类型列表 ==========
                // 遍历函数声明的形参，结合泛型映射表解析为实际类型
                const declareParamsTypes = functionDeclarePath.get('params').map(item => {
                    // 传入泛型映射表，解析泛型形参为实际类型（如 T → string）
                    return resolveRealType(item.getTypeAnnotation(), realTypeMap);
                });

                // ========== 步骤5：逐位校验实参类型与泛型绑定后的形参类型 ==========
                argumentsTypes.forEach((argType, index) => {
                    const paramType = declareParamsTypes[index];

                    // 过滤：仅当两者均为有效类型且不相等时才报错（避免 undefined 误判）
                    if (argType && paramType && argType !== paramType) {
                        // 执行无堆栈的错误创建逻辑，精准定位错误参数
                        noStackTraceWrapper(Error => {
                            const errorMessage = `${argType} can not assign to ${paramType}`;
                            // 构建带代码帧的错误（定位到第 index 个实参位置）
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