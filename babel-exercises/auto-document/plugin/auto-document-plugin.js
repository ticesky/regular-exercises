/**
 * Babel 自动生成文档插件
 * 核心功能：
 * 1. 解析代码中的函数/类的 TS 类型注解、JSDoc 注释
 * 2. 提取函数/类的名称、参数、返回值、属性、方法等信息
 * 3. 支持生成 JSON/Markdown/HTML 格式的文档文件
 */
const path = require('path');
const fse = require('fs-extra');
const { declare } = require('@babel/helper-plugin-utils');
const { parseComment, generate, resolveType } = require('./utils');

const autoDocumentPlugin = declare((api, options) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('docs', []);
        },
        visitor: {
            // 处理函数声明节点（FunctionDeclaration）
            // 提取函数名称、参数、返回值、JSDoc 注释等信息
            FunctionDeclaration(path, state) {
                const docs = state.file.get('docs');
                docs.push({
                    type: 'function', // 节点类型标识
                    name: path.get('id').toString(), // 函数名称
                    // 提取函数参数信息（名称 + 类型）
                    params: path.get('params').map(paramPath => {
                        return {
                            name: paramPath.toString(), // 参数名
                            type: resolveType(paramPath.getTypeAnnotation()) // 参数类型
                        }
                    }),
                    return: resolveType(path.get('returnType').getTypeAnnotation()),
                    // 提取函数的前置 JSDoc 注释（取第一个注释）
                    doc: path.node.leadingComments && parseComment(path.node.leadingComments[0]?.value)
                });
                state.file.set('docs', docs);
            },
            // 处理类声明节点（ClassDeclaration）
            // 提取类名称、构造函数、属性、方法、JSDoc 注释等信息
            ClassDeclaration(path, state) {
                const docs = state.file.get('docs');
                // 初始化类信息对象
                const classInfo = {
                    type: 'class', // 节点类型标识
                    name: path.get('id').toString(), // 类名称
                    constructorInfo: {}, // 构造函数信息
                    methodsInfo: [], // 类方法信息
                    propertiesInfo: [] // 类属性信息
                };
                // 提取类的前置 JSDoc 注释
                if (path.node.leadingComments) {
                    classInfo.doc = parseComment(path.node.leadingComments[0]?.value);
                }
                // 遍历类内部节点，提取属性/方法/构造函数信息
                path.traverse({
                    /**
                     * 处理类属性节点（ClassProperty）
                     * 提取属性名称、类型、注释信息
                     */
                    ClassProperty(path) {
                        classInfo.propertiesInfo.push({
                            name: path.get('key').toString(), // 属性名
                            type: resolveType(path.getTypeAnnotation()), // 属性类型
                            // 提取属性的前置/后置注释（过滤空值后解析）
                            doc: [path.node.leadingComments, path.node.trailingComments]
                                .filter(Boolean)
                                .flatMap(comments => comments.map(comment => parseComment(comment.value)))
                                .filter(Boolean)
                        })
                    },
                    /**
                     * 处理类方法节点（ClassMethod）
                     * 区分构造函数和普通方法，提取不同信息
                     */
                    ClassMethod(path) {
                        if (path.node.kind === 'constructor') {
                            classInfo.constructorInfo = {
                                // 提取构造函数参数信息
                                params: path.get('params').map(paramPath => {
                                    return {
                                        name: paramPath.toString(),
                                        type: resolveType(paramPath.getTypeAnnotation()),
                                        doc: parseComment(path.node.leadingComments?.[0].value)
                                    }
                                })
                            }
                        } else {
                            // 处理普通类方法
                            classInfo.methodsInfo.push({
                                name: path.get('key').toString(),
                                doc: parseComment(path.node.leadingComments[0]?.value),
                                params: path.get('params').map(paramPath => {
                                    return {
                                        name: paramPath.toString(),
                                        type: resolveType(paramPath.getTypeAnnotation())
                                    }
                                }),
                                return: resolveType(path.get('returnType').getTypeAnnotation())
                            })
                        }
                    }
                });
                docs.push(classInfo);
                state.file.set('docs', docs);
            }
        },
        post(file) {
            const docs = file.get('docs');
            // 根据配置的格式生成文档内容和扩展名
            const res = generate(docs, options.format);
            // 确保输出目录存在（递归创建，如不存在则新建）
            fse.ensureDirSync(options.outputDir);
            // 拼接文档文件路径（如 outputDir/docs.json）
            const docPath = path.join(options.outputDir, 'docs' + res.ext);
            // 写入文档文件（编码为 utf8 避免中文乱码）
            fse.writeFileSync(docPath, res.content, 'utf8');
        }
    }
});

module.exports = autoDocumentPlugin;