/**
 * 解析 TypeScript 类型注解，转换为可读的类型字符串
 * 目前支持：string/number/boolean 基础类型，可扩展更多类型
 * @param {import('@babel/types').TSType|import('@babel/types').FlowType} tsType AST 中的 TS 类型注解节点
 * @returns {string|undefined} 简化后的类型字符串（如 'string'），无类型注解则返回 undefined
 */
function resolveType(tsType) {
    // 匹配 TS 基础类型关键字，转换为可读字符串
    switch (tsType.type) {
        case 'TSStringKeyword':
            return 'string';
        case 'TSNumberKeyword':
            return 'number';
        case 'TSBooleanKeyword':
            return 'boolean';
        case 'TSArrayType':
            return 'array';
        case 'TSObjectKeyword':
            return 'object';
        case 'NumberTypeAnnotation': 
            return 'number';
        case 'StringTypeAnnotation':
            return 'string';
        default:
            return 'unknown'; // 未知类型统一返回 unknown
    }
}

/**
 * 错误堆栈屏蔽封装函数
 * 核心作用：执行回调时临时关闭堆栈跟踪，减少错误信息冗余，仅保留代码帧
 * @param {Function} cb 回调函数，接收 Error 构造函数作为参数
 */
function noStackTraceWrapper(cb) {
    // 保存原始堆栈跟踪限制值
    const tmp = Error.stackTraceLimit;
    // 关闭堆栈跟踪（设置为 0，不生成堆栈信息）
    Error.stackTraceLimit = 0;
    // 执行回调（传入 Error 构造函数，用于创建错误对象）
    cb && cb(Error);
    // 恢复原始堆栈跟踪限制
    Error.stackTraceLimit = tmp;
}

module.exports = {
    resolveType,
    noStackTraceWrapper
};