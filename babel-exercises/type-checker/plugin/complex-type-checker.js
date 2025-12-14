/**
 * Babel TypeScript 复杂类型校验插件（泛型+类型别名+条件类型）
 * 复杂 TS 项目（含泛型、类型别名、条件类型）的函数参数类型校验
 * 核心功能：
 * 1. 解析 TS 类型别名（TSTypeAliasDeclaration），支持泛型类型别名存储与复用
 * 2. 支持条件类型求值（type Eval<T> = T extends string ? number : string）
 * 3. 嵌套解析泛型类型引用（如 Alias<T> → 解析为条件类型求值结果）
 * 4. 校验泛型函数调用时实参类型与「类型别名解析后的形参类型」一致性
 * 5. 类型不匹配时抛出带代码帧的语义错误，屏蔽冗余堆栈信息
 */
const { declare } = require('@babel/helper-plugin-utils');
const { noStackTraceWrapper } = require('./utils')

/**
 * 条件类型求值核心函数
 * 解析 TS 条件类型（T extends U ? X : Y），返回匹配的分支类型
 * @param {Object} node 条件类型节点（包含 checkType/extendsType/trueType/falseType）
 * @param {Object} params 泛型参数映射表（如 { T: 'string', U: 'number' }）
 * @returns {string|undefined} 条件类型求值后的实际类型（如 string/number）
 */
function typeEval(node, params) {
    // 条件类型的检测类型（T extends U 中的 T）
    let checkType;
    // 场景1：检测类型是泛型引用（如 T → 映射为实际类型）
    if (node.checkType?.type === 'TSTypeReference') {
        checkType = params[node.checkType.typeName?.name];
    }
    // 场景2：检测类型是基础类型（如 string/number） 
    else {
        checkType = resolveType(node.checkType);
    }
    // 解析条件类型的基准类型（T extends U 中的 U）
    const extendsType = resolveType(node.extendsType);
    // 条件判断：匹配则返回 true 分支类型，否则返回 false 分支类型
    // 支持基础类型相等判断 + 实例类型判断（兼容对象类型）
    if (checkType === extendsType || checkType instanceof extendsType) {
        return resolveType(node.trueType);
    } else {
        return resolveType(node.falseType);
    }
}

/**
 * 递归解析 TS 类型注解节点（支持基础类型/泛型/类型别名/条件类型）
 * @param {Object} targetType AST 中的类型注解节点（TSTypeAnnotation/TSTypeReference 等）
 * @param {Object} [referenceTypesMap={}] 泛型类型映射表（如 { T: 'string' }）
 * @param {import('@babel/traverse').Scope} [scope] Babel 作用域对象（用于获取类型别名）
 * @returns {string|undefined} 解析后的实际类型字符串，不支持的类型返回 undefined
 */
function resolveType(targetType, referenceTypesMap = {}, scope) {
    // 基础 TS 类型注解映射表：原生类型节点 → 可读类型名
    const tsTypeAnnotationMap = {
        TSStringKeyword: 'string',  // TS 字符串类型
        TSNumberKeyword: 'number'   // TS 数字类型
    };

    // 空值容错：避免类型节点为空或无 type 字段时报错
    if (!targetType?.type) return undefined;

    // 递归解析不同类型注解节点
    switch (targetType.type) {
        // ========== 基础 TS 类型注解（如 const a: string） ==========
        case 'TSTypeAnnotation':
            // 子场景1：泛型类型引用（如 T → 映射为实际类型）
            if (targetType.typeAnnotation?.type === 'TSTypeReference') {
                const genericTypeName = targetType.typeAnnotation.typeName?.name;
                return referenceTypesMap[genericTypeName];
            }
            // 子场景2：基础 TS 类型（如 string/number）
            return tsTypeAnnotationMap[targetType.typeAnnotation?.type];
        // ========== Flow 类型注解（兼容 Flow 语法） ==========
        case 'NumberTypeAnnotation':
            return 'number';
        case 'StringTypeAnnotation':
            return 'string';

        // ========== TS 基础类型关键字（直接节点类型） ==========
        case 'TSNumberKeyword':
            return 'number';

        // ========== TS 泛型类型引用（如 Alias<T>） ==========
        case 'TSTypeReference': {
            // 1. 从作用域获取类型别名（如 Alias → 存储的类型别名配置）
            const typeAlias = scope?.getData(targetType.typeName?.name);
            if (!typeAlias) return undefined; // 无类型别名，返回 undefined

            // 2. 解析泛型类型参数（如 Alias<string, number> → ['string', 'number']）
            const paramTypes = (targetType.typeParameters?.params || []).map(item => {
                return resolveType(item, referenceTypesMap, scope); // 递归解析参数类型
            });

            // 3. 构建泛型参数映射表（如 { T: 'string', U: 'number' }）
            const params = (typeAlias.paramNames || []).reduce((obj, name, index) => {
                obj[name] = paramTypes[index];
                return obj;
            }, {});

            // 4. 求值类型别名（支持条件类型）并返回结果
            return typeEval(typeAlias.body, params);
        }

        // ========== TS 字面量类型（如 const a: 'foo'） ==========
        case 'TSLiteralType':
            return targetType.literal?.value; // 返回字面量值（如 'foo'/123）

        // ========== 可扩展：支持更多类型（布尔/数组/对象/条件类型直接节点） ==========
        // case 'TSBooleanKeyword':
        //     return 'boolean';
        // case 'TSArrayType':
        //     return `${resolveType(targetType.elementType, referenceTypesMap, scope)}[]`;
        default:
            return undefined;
    }
}

const complexTypeCheckerPlugin = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('errors', []);
        },
        visitor: {
            //处理 TS 类型别名声明节点（TSTypeAliasDeclaration）
            //核心逻辑：将类型别名存储到作用域，供后续泛型解析使用
            TSTypeAliasDeclaration(path) {
                // 1. 获取类型别名名称（如 type Alias<T> = ... → Alias）
                const aliasName = path.get('id').toString();
                // 2. 提取类型别名的泛型参数名列表（如 <T,U> → ['T','U']）
                const paramNames = (path.node.typeParameters?.params || []).map(item => {
                    return item.name;
                });
                // 3. 获取类型别名的主体类型注解（如 T extends string ? number : string）
                const body = path.getTypeAnnotation();
                // 4. 将类型别名配置存储到当前作用域（供后续解析使用）
                path.scope.setData(aliasName, { paramNames, body });
            },
            CallExpression(path, state) {
                const errors = state.file.get('errors');

                // ========== 步骤1：解析函数调用的泛型类型参数（如 fn<Alias<string>> → 解析为实际类型） ==========
                const realTypes = (path.node.typeParameters?.params || []).map(item => {
                    return resolveType(item, {}, path.scope); // 传入作用域，支持类型别名解析
                });

                // ========== 步骤2：解析函数调用的实参类型列表 ==========
                const argumentsTypes = path.get('arguments').map(item => {
                    return resolveType(item.getTypeAnnotation(), {}, path.scope);
                });

                // ========== 步骤3：定位函数声明节点，构建泛型类型映射表 ==========
                const calleeName = path.get('callee').toString(); // 获取函数名（如 fn）
                const functionBinding = path.scope.getBinding(calleeName); // 获取函数绑定
                if (!functionBinding) return;
                const functionDeclarePath = functionBinding.path; // 函数声明节点路径
                // 构建泛型参数映射表（如 T → 解析后的实际类型 string）
                const realTypeMap = {};
                (functionDeclarePath.node.typeParameters?.params || []).forEach((item, index) => {
                    realTypeMap[item.name] = realTypes[index];
                });

                // ========== 步骤4：解析泛型+类型别名后的形参类型列表 ==========
                const declareParamsTypes = functionDeclarePath.get('params').map(item => {
                    return resolveType(item.getTypeAnnotation(), realTypeMap, path.scope);
                });

                // ========== 步骤5：逐位校验实参/形参类型一致性 ==========
                argumentsTypes.forEach((argType, index) => {
                    const paramType = declareParamsTypes[index];
                    if (argType && paramType && argType !== paramType) {
                        noStackTraceWrapper(Error => {
                            const errorMessage = `${argType} can not assign to ${paramType}`;
                            // 精准定位错误参数，生成带代码帧的错误
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

module.exports = complexTypeCheckerPlugin;