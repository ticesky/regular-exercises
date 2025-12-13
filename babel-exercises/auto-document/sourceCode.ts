/**
 * say 你好
 * @param {string} name 名字
 * @param {number} age 年龄
 * @returns 返回一句话
 */
function sayHi (name: string, age: number, a: boolean):string {
    console.log(`hi, ${name}`);
    return `hi, ${name}`;
}

/**
 * 类测试
 */
class Guang {
    // name 属性
    name: string;

    // 构造函数
    constructor(name: string) {
        this.name = name;
    }

    /**
     * 方法测试
     */
    sayHi ():string {
        return `hi, I'm ${this.name}`;
    }
}