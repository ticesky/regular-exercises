/**
 * Babel 变量名混淆压缩插件
 * 核心功能：
 * 1. 对代码中所有可作用域化（Scopable）节点内的变量名进行混淆重命名
 * 2. 使用 Base54 编码生成极简变量名（a-z/A-Z/$_ 共54个字符），减少代码体积
 * 3. 按作用域层级处理，避免变量名冲突，保证代码语法正确性
 * 设计思路：
 * - Base54 编码：用 54 个合法 JS 标识符字符生成短变量名（0→a、54→ba、108→ca...）
 * - 作用域安全：基于 Babel 作用域绑定（Binding）处理，避免跨作用域命名冲突
 * - 去重处理：标记已混淆的变量，避免重复重命名
 */
const { declare } = require('@babel/helper-plugin-utils');

/**
 * Base54 编码函数（IIFE 封装，避免全局变量污染）
 * 编码规则：
 * - 字符集：a-z（26） + A-Z（26） + $ + _ → 共 54 个合法 JS 标识符字符
 * - 编码逻辑：将数字转为 54 进制，映射到字符集生成短字符串（如 0→a、53→_、54→ba）
 * @param {number} num 待编码的数字（全局递增的 UID）
 * @returns {string} Base54 编码后的短字符串（极简变量名）
 */
const base54 = (function () {
    const DIGITS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_";
    return function (num) {
        let ret = ""; // 存储编码结果
        // 54 进制转换：循环取余 + 拼接字符
        do {
            // 取余获取当前位的字符，拼接到结果头部（保证进制转换顺序）
            ret = DIGITS.charAt(num % 54) + ret;
            // 整除 54，处理下一位
            num = Math.floor(num / 54);
        } while (num > 0);
        return ret;
    };
})();

const manglePlugin = declare((api) => {
    api.assertVersion(7);

    return {
        pre(file) {
            // 初始 UID 为 0，确保变量名从 a 开始
            file.set('uid', 0);
        },
        visitor: {
            Scopable: {
                exit(path, state) {
                    // if(!toplevel && !path.scope.parent) {
                    //     return;
                    // }
                    // if(path.scope.hasEval) {
                    //     return;
                    // }

                    // ========== 1. 获取全局递增 UID ==========
                    let uid = state.file.get('uid'); // 从文件对象获取当前 UID

                    // ========== 2. 遍历当前作用域的所有变量绑定 ==========
                    // Object.entries(path.scope.bindings)：获取作用域内所有变量（key: 变量名，value: 绑定信息）
                    Object.entries(path.scope.bindings).forEach(([key, binding]) => {
                        // 跳过已混淆的变量（避免重复重命名）
                        if (binding.mangled) return;
                        // 标记变量为已混淆，防止重复处理
                        binding.mangled = true;

                        // ========== 3. 生成新的混淆变量名 ==========
                        // 1. base54(uid++)：将 UID 转为 Base54 短字符串（如 0→a、1→b...）
                        // 2. generateUid：基于 Base54 字符串生成作用域内唯一的变量名（避免冲突）
                        const newName = path.scope.generateUid(base54(uid++));

                        // ========== 4. 重命名变量（作用域安全） ==========
                        // rename(key, newName)：将当前作用域内的 key 变量重命名为 newName
                        // 自动处理所有引用位置，保证代码语法正确
                        binding.path.scope.rename(key, newName)
                    });
                    state.file.set('uid', uid);
                }
            }
        }
    }
});

module.exports = manglePlugin;