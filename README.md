# **sPARks** / **sPARKs**
by SUN

**2021/4/6 _更新_：现支持求解FIRST/FOLLOW集**

#### 一个js编写的“递归下降”语法分析器

demo: 这里是一个使用基础版本的sPARks编写的PL/0语言翻译器，在AST上naive地翻译成JS代码使得PL/0程序可以大致运行：https://xiaowangxu.github.io/sun/PL0/

-----
### 包含
- ```SourceScript``` 源代码输入，提供```get/peek```方法，同时配合```ScriptPosition```可输出源代码的指定位置并高亮
- ```ScriptPosition``` 指出源码中的一段
- ```Lexer``` 一个简单的词法分析器，和相关类库（```BaseError```/```Token```）
- ```sPARks``` 递归下降语法解析
- ```JSConverter``` PL/0 AST 到 JavaScript 翻译器

----
### 基本使用
```js
// 使用SPARK_registe注册非终结符
// 条件语句 ::= if <条件表达式> then <语句> [ (else <语句>) ]
SPARK_registe('条件语句', () => {
	return new SPARK_Match([
		new MatchToken("TK_KEYWORD", "if"), // 匹配终结符
		new MatchTerm('条件表达式', undefined),// 匹配非终结符
		new MatchToken("TK_KEYWORD", "then"),
		new MatchTerm('语句', undefined),
		new Once_or_None([
			new SPARK_Match([
				new MatchToken("TK_KEYWORD", "else"),
				new MatchTerm('语句', undefined)
			], (match, token) => {
				return match.nodes[0]
			})
		], undefined, true)
	], (match, token) => {
		return ['if', {
			type: 'if',
			expression: match.nodes[0][1],
			sub: [match.nodes[1][1]],
			else: [match.nodes[2][1]]
		}]
	})
})

SPARK_get("条件语句")	// 获取一个非终结符的解析器
SPARK_check()		// 检查文法是否含有左递归
SPARK_print()		// 输出BNF文法

let source = new SourceScript(`
	# sPARks PL/0 Hello World !!
	# 在这里键入PL/0 程序
	if a < b then
		max := a
	else
		max := b
	`, 
	"Test sript");
let lexer = new Lexer(source);
lexer.tokenize();
let [finished, fin_index, ast, error, error_index] = SPARK_get("条件语句").match(lexer.tokens);
// ast即为解析成的语法树
```

---
### 一些特性
- 基于BNF文法表达
- 文法输出
- 左递归检测
- 可随意手动介入的AST生成
- 自动错误提示
- 自动求解文法的FIRST/FOLLOW集

---
### **未来进度：**
sPARks
- [x] More_or_None 的错误提示
- [x] 左递归检查
- [x] 默认AST格式 // 实验特性，可作为文法测试使用，实际中请手动实现
- [ ] 更友好的错误提示
- [ ] 更泛化的词法分析器
- [x] 生成First集合
- [x] 生成Follow集合 // 2021/4/6 通过书上的测试和自定义测试
- [ ] 提供LL(1)分析器
- [ ] LR分析器 ？
- [ ] 提供范例语言sunLang

在 https://xiaowangxu.github.io/sun/PL0/ 的改进
- [x] 扩充PL/0语法，部分完成
- [ ] 语义分析 // 类型推导，AST上的静态优化，静态检查
- [ ] 中间代码生成 SSA or 四元数
- [ ] 中间代码优化
- [ ] PL/0 虚拟机 基于AST 或 中间代码
- [ ] 链接llvm后端 ？