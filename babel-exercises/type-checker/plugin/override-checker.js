/**
 * Babel override 修饰符合法性校验插件
 * 避免 TypeScript/自定义语法中 `override` 修饰符使用错误（修饰了父类不存在的方法）
 * 核心功能：
 * 1. 检测子类中标记 `override` 修饰符的方法，是否在父类中存在同名方法
 * 2. 若子类方法加了 `override` 但父类无该方法，抛出带代码帧的语义错误
 * 3. 仅校验 ClassDeclaration 类声明（暂不处理 ClassExpression）
 */
const { declare } = require('@babel/helper-plugin-utils');
const { noStackTraceWrapper } = require('./utils');

/**
 * 提取类声明节点中所有方法的名称
 * @param {import('@babel/traverse').NodePath} classDeclarationNodePath 类声明节点路径（ClassDeclaration）
 * @returns {string[]} 类中所有方法名称的数组（如 ['constructor', 'getName', 'setAge']）
 */
function getAllClassMethodNames(classDeclarationNodePath) {
    const state = {
        allSuperMethodNames: [] // 存储父类所有方法名
    }
    // 遍历类声明节点内的所有 ClassMethod 节点（提取方法名）
    classDeclarationNodePath.traverse({
        ClassMethod(path) {
            // 获取方法名的字符串形式（如 key 为标识符则取 name，为字面量则取值）
            state.allSuperMethodNames.push(path.get('key').toString())
        }
    });
    return state.allSuperMethodNames;
}

const overrideCheckerPlugin = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            file.set('errors', []);
        },
        visitor: {
            ClassDeclaration(path, state) {
                const semanticErrors = state.file.get('errors');

                // ========== 1. 仅处理有父类的子类（存在 superClass） ==========
                const superClassNode = path.node.superClass;
                if (!superClassNode) return; // 无父类（非继承类），无需校验

                // ========== 2. 获取父类的类声明节点 ==========
                // 从当前作用域获取父类名称的绑定（如 class A extends B → 获取 B 的绑定）
                const superClassBinding = path.scope.getBinding(superClassNode.name);
                if (!superClassBinding) {
                    // 父类未声明（如 extends 一个未定义的变量），跳过校验（可扩展：抛出未定义错误）
                    return;
                }
                // 父类的 ClassDeclaration 节点路径
                const superClassPath = superClassBinding.path;

                // ========== 3. 提取父类所有方法名 ==========
                const allSuperMethodNames = getAllClassMethodNames(superClassPath);

                // ========== 4. 遍历子类方法，校验 override 修饰符 ==========
                path.traverse({
                    // 处理子类中的 ClassMethod 节点
                    // 校验标记 override 的方法是否在父类中存在
                    ClassMethod(path) {
                        if (path.node.override) {
                            // 获取子类方法名
                            const methodName = path.get('key').toString();
                            // 获取父类名称（用于错误提示）
                            const superClassName = superClassPath.get('id').toString();

                            // ========== 5. 父类无该方法 → 抛出语义错误 ==========
                            if (!allSuperMethodNames.includes(methodName)) {
                                noStackTraceWrapper(Error => {
                                    const errorMessage = `this member cannot have an 'override' modifier because it is not declared in the base class '${superClassName}'`;
                                    semanticErrors.push(path.get('key').buildCodeFrameError(errorMessage, Error));
                                })
                            }
                        }
                    }
                });
                state.file.set('errors', semanticErrors);
            }
        },
        post(file) {
            console.log(file.get('errors'));
        }
    }
});

module.exports = overrideCheckerPlugin;