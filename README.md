# **sPARks** / **sPARKs**

**S**un **P**arser **K**it**S**

#### 一个js编写的“递归下降”语法分析器

demo: 这里是一个使用基础版本的sPARks编写的PL/0语言翻译器，在AST上naive地翻译成JS代码使得PL/0程序可以大致运行：https://xiaowangxu.github.io/sun/PL0/

> 思考和妥协后发现，在牺牲一定的语法整洁性的情况下是可以自动计算Select集的，因此将计算SelectSet作为实验功能，附加LL(1)检查和文法提示，也许提供LL(1)分析器是可行的了。

---
**2021/4/6 _更新_：现支持求解FIRST/FOLLOW集**

**2021/4/9 _更新_：基于Walker/Collect/Transform的静态分析和AST变换**

**2021/4/12 _更新_：新增 ```Language``` 语言类, 接口大改**

**2012/4/13 _更新_：```Language``` 重构PL0语言，调用 ```PL0()``` 即可获得一个PL0分析器**

**2012/4/14 _更新_：新增 ```BasicCalculator``` 简单公式分析语言**

**2012/4/17 _更新_：新增 ```DFA``` 确定有限状态机 支持 ```NFA``` 到 ```DFA``` 的转换**

**2012/4/24 _更新_：若文法是正规文法，可调用 ```get_SelectSet()``` 计算Select集**

-----
### 包含
- ```SourceScript``` 源代码输入，提供 ```get / peek``` 方法，同时配合 ```ScriptPosition``` 可输出源代码的指定位置并高亮
- ```ScriptPosition``` 指出源码中的一段
- ```Lexer``` 一个简单的词法分析器，和相关类库（```BaseError``` / ```Token```）
- ```sPARks``` 递归下降语法解析
- ```JSConverter``` PL/0 AST 到 JavaScript 翻译器

----
### 基本使用

#### 使用内置语言实现
```js
// 内建了PL0/BasicCalculator的语言
let BasicCalcutor = BasicCalcutor();

let source = new SourceScript("1+(2*3.14)/(233+12)", "Test script");

let lexer = new Lexer(source);
lexer.tokenize();

let [finished, fin_index, ast, error, error_index] = BasicCalcutor.match(lexer.tokens);
```

#### 自定义语言
```js
// 条件语句 ::= if <条件表达式> then <语句> [ (else <语句>) ]
let ebnf = {'条件语句': () => {
	return new Match([
		new MatchToken("TK_KEYWORD", "if"), // 匹配终结符
		new MatchTerm('条件表达式', undefined),// 匹配非终结符
		new MatchToken("TK_KEYWORD", "then"),
		new MatchTerm('语句', undefined),
		new Once_or_None([
			new Match([
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
};

let TestLang = new Language("TestLang", ebnf, "if");
// 自动检查文法是否含有左递归
// 并生成First/Follow集

TestLang.print();   // 输出EBNF文法

let source = new SourceScript(`
# sPARks PL/0 Hello World !!
# 在这里键入PL/0 程序
if a < b then
	max := a
else
	max := b
`, 
"Test script");

let lexer = new Lexer(source);
lexer.tokenize();

let [finished, fin_index, ast, error, error_index] = TestLang.match(lexer.tokens);
// ast即为解析成的语法树
```

---
### 一些特性
- 基于EBNF文法表达
- 文法输出
- 左递归检测
- 可随意手动介入的AST生成
- 自动错误提示
- 自动求解文法的First/Follow集
- 自动求解正规文法的Select集
- Walker Ast遍历转换

---
### **未来进度：**
sPARks
- [x] AST的 start / end 替换为 ```ScriptPosition```
- [x] 新增 ```Language``` 语言类
- [x] More_or_None 的错误提示
- [x] 左递归检查
- [x] 默认AST格式 // 实验特性，可作为文法测试使用，实际中请手动实现
- [x] 更友好的错误提示
- [x] 生成First集合
- [x] 生成Follow集合 // 2021/4/6 通过书上的测试和自定义测试
- [ ] 生成Select集合
- [ ] 提供LL(1)分析器
- [ ] 提供范例语言sunLang

在 https://xiaowangxu.github.io/sun/PL0/ 的改进
- [x] 扩充PL/0语法，部分完成
- [x] 语义分析 // 类型推导，AST上的静态优化，静态检查 // 进行中
- [x] 中间代码生成 SSA or 四元数 // SSIR 进行中
- [ ] 中间代码优化
- [ ] PL/0 虚拟机 基于AST 或 中间代码
- [ ] 链接llvm后端 ？
