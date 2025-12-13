const doctrine = require('doctrine'); // 解析 JSDoc 注释的工具
const renderer = require('./renderer');

/**
 * 解析 JSDoc 注释字符串
 * @param {string} commentStr 原始注释字符串（如 '/** 这是注释 *\/'）
 * @returns {Object|undefined} 解析后的 JSDoc 注释对象（包含 tags、description 等），无注释则返回 undefined
 */
function parseComment(commentStr) {
    if (!commentStr) {
        return;
    }
    return doctrine.parse(commentStr, {
        unwrap: true
    });
}

/**
 * 根据指定格式生成文档内容
 * @param {Array} docs 提取的文档元数据（函数/类的信息数组）
 * @param {string} [format='json'] 输出格式（json/markdown/html）
 * @returns {Object} 包含文件扩展名和文档内容的对象
 * @property {string} ext 文件扩展名（如 .json/.md/.html）
 * @property {string} content 渲染后的文档内容
 */
function generate(docs, format = 'json') {
    if (format === 'markdown') {
        return {
            ext: '.md',
            content: renderer.markdown(docs)
        }
    } else if (format === 'html') {
        return {
            ext: '.html',
            content: renderer.html(docs)
        }
    } else {
        return {
            ext: '.json',
            content: renderer.json(docs)
        }
    }
}

/**
 * 解析 TypeScript 类型注解，转换为可读的类型字符串
 * 目前支持：string/number/boolean 基础类型，可扩展更多类型
 * @param {import('@babel/types').TSType} tsType AST 中的 TS 类型注解节点
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
        default:
            return 'unknown'; // 未知类型统一返回 unknown
    }
}

module.exports = {
    parseComment,
    generate,
    resolveType
};