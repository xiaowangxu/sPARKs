export class ScriptPosition {
	constructor(script_name = 'unknown script', line = 0, col = -1) {
		this.line = line;
		this.col = col;
		this.script = script_name;
	}

	next() {
		this.col++;
	}

	newline() {
		this.col = -1;
		this.line++;
	}

	copy(from) {
		this.line = from.line;
		this.col = from.col;
		this.script = from.script;
	}

	clone() {
		return new ScriptPosition(this.script, this.line, this.col);
	}

	toString() {
		return `<${this.script}> ${this.line}:${this.col}`
	}
}

export class SourceScript {
	constructor(script, script_name) {
		this.script = script;
		this.script_name = script_name;
		this.length = script.length;
		this.current = -1;
	}

	get() {
		this.current++;
		if (this.is_EOF()) {
			return '\0';
		}
		return this.script[this.current];
	}

	peek(n = 1) {
		if (this.current + n >= this.length) {
			return '\0';
		}
		return this.script[this.current + n];
	}

	is_EOF() {
		return this.current >= this.length;
	}

	reset() {
		this.current = -1;
	}

	get_ScriptPortion(start, end, linemark = "=", color, ret = true) {
		if (color !== undefined)
			linemark = `<a style='color: ${color};'>${linemark}</a>`
		let linescount = this.script.split('\n').length
		let lines = this.script.split('\n').splice(start.line, end.line - start.line + 1);
		let linecountlen = (linescount).toString().length
		let str = ""//`${start.toString()}:${end.toString()}\n`;

		function match(str, size) {
			let ans = ''
			for (let i = str.length; i < size; i++) {
				ans += ' '
			}
			return ans + str
		}

		let linefront = `${match('', linecountlen)} | `;

		let start_pos = start.col;
		let tokestart = "";
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			str += `${match((start.line + i + 1).toString(), linecountlen)} | ${line}`;
			str += `\n${linefront}`;
			for (let j = 0; j < start_pos; j++) {
				if (line[j] === '\t') {
					str += "\t";
					tokestart += "\t";
				}
				else {
					str += " ";
					tokestart += " ";
				}
			}
			if (i < lines.length - 1) {
				for (let j = start_pos; j < line.length; j++) {
					if (line[j] === '\t') {
						str += "\t"
					}
					else
						str += linemark;
				}
				tokestart = "";
			}
			else {
				for (let j = start_pos; j < end.col + 1; j++) {
					if (line[j] === '\t') {
						str += "\t";
						tokestart += "\t";
					}
					else {
						str += linemark;
						tokestart += " ";
					}
				}
			}
			start_pos = 0;
			if (ret)
				str += '\n';
			else if (i !== lines.length - 1)
				str += '\n';
		}

		return [str, linefront, tokestart];
	}
}

const TOKENS = {
	TK_UNKNOW: "",
	TK_INT: "整数",
	TK_FLOAT: "浮点数",
	TK_STRING: "字符串",
	TK_IDENTIFIER: "标识符",
	TK_ADD: "+",
	TK_MINUS: "-",
	TK_MULTIPIY: "*",
	TK_DIVIDE: "/",
	TK_MOD: "%",
	TK_DOT: ".",
	TK_LCIR: "(",
	TK_RCIR: ")",
	TK_LSQR: "[",
	TK_RSQR: "]",
	TK_LBRACE: "{",
	TK_RBRACE: "}",
	TK_KEYWORD: "关键字",
	TK_ASSIGN: "=",
	TK_EQUAL: "==",
	TK_NOTEQUAL: "<>",
	TK_LESS: "<",
	TK_GREATER: ">",
	TK_LESSE: "<=",
	TK_GREATERE: ">=",
	TK_TO: "->",
	TK_TYPEDEFINE: ":",
	TK_BECOME: ":=",
	TK_END: ";",
	TK_NEWLINE: "\\n",
	TK_TAB: "\\t",
	TK_COMMA: ",",
	TK_EOF: "EOF"
}

export class Token {
	constructor(type, val, start, end) {
		this.type = type;
		this.value = val;
		if (start)
			this.start = start.clone();
		if (end)
			this.end = end.clone();
	}

	equal(token) {
		return this.type === token.type && this.value === token.value;
	}
}

export class BaseError {
	constructor(type = "Error", msg = "", start, end, info) {
		this.type = type;
		this.message = msg;
		this.start = start.clone();
		this.end = end.clone();
		this.info = info;
	}
}

export class Lexer {
	constructor(sourcescript) {
		this.sourcescript = sourcescript;
		this.current = '';
		this.current_pos = new ScriptPosition(this.sourcescript.script_name);
		this.last_pos = new ScriptPosition(this.sourcescript.script_name);
		this.tokens = [];
		this.errors = [];
	}

	is_EOF() {
		if (this.current === '\0')
			return true;
		else
			return false;
	}

	is_SpaceChar(char) {
		switch (char) {
			case ' ':
			case '\n':
			case '\t':
			case '\r':
			case '\0':
				return true;
		}
		return false;
	}

	is_IdentifierChar(char) {
		const KEY = ("\'\"~!@#$%^&*()+-{}[]\\|;:,.<>?/~`= ").split('');
		return !this.is_SpaceChar(char) && !KEY.includes(char);
	}

	is_NumberChar(char) {
		switch (char) {
			case '0':
			case '1':
			case '2':
			case '3':
			case '4':
			case '5':
			case '6':
			case '7':
			case '8':
			case '9':
				return true;
		}
		return false;
	}

	advance() {
		if (this.sourcescript.is_EOF())
			return;
		this.current = this.sourcescript.get();
		this.current_pos.next();
		if (this.current === '\n')
			this.current_pos.newline();
	}

	peek(n = 1) {
		return this.sourcescript.peek(n);
	}

	// customize

	get_Number() {
		let number = "";
		let dot_count = 0;
		let position = this.current_pos.clone();

		while (!this.is_EOF() && (this.is_NumberChar(this.current) || this.current === '.')) {
			position = this.current_pos.clone();
			if (this.current === '.') {
				if (!this.is_NumberChar(this.peek())) break;
				if (dot_count === 1)
					break;
				dot_count++;
				number += '.';
			}
			else {
				number += this.current;
			}
			if (this.peek() === '.' && !this.is_NumberChar(this.peek(2))) {
				this.advance();
				break;
			}
			this.advance();
		}

		if (dot_count === 0)
			this.tokens.push(new Token('TK_INT', parseInt(number), this.last_pos, position));
		else
			this.tokens.push(new Token('TK_FLOAT', parseFloat(number), this.last_pos, position));
	}

	get_Identifier() {
		let identifier = "";
		let position = this.current_pos.clone();

		while (!this.is_EOF() && this.is_IdentifierChar(this.current)) {
			position = this.current_pos.clone();
			identifier += this.current;
			this.advance();
		}

		const KEYWORD = ["begin", "int", "real", "string", "call", "const", "do", "end", "if", "else", "odd", "procedure", "read", "then", "var", "while", "write"];

		let keyword = identifier.toLowerCase()

		if (KEYWORD.includes(keyword))
			this.tokens.push(new Token('TK_KEYWORD', keyword, this.last_pos, position));
		else
			this.tokens.push(new Token('TK_IDENTIFIER', identifier, this.last_pos, position));
	}

	get_String() {
		let str = "";
		let position = this.current_pos.clone();
		this.advance();
		let has_slash = false;
		let ended = false;


		while (!this.is_EOF()) {
			position = this.current_pos.clone();
			if (this.current === '\\') {
				if (has_slash) {
					str += this.current;
					has_slash = false;
				}
				else {
					str += '\\';
					has_slash = true;
				}
			}
			else if (this.current === '"') {
				if (has_slash) {
					str += '"';
					has_slash = false;
				}
				else {
					ended = true;
					this.advance();
					break;
				}
			}
			else {
				has_slash = false;
				if (this.current === '\n')
					// str += '\\n';
					str += '\n';
				else if (this.current === '\t')
					str += '\t';
				else
					str += this.current;
			}
			this.advance();
		}

		if (ended)
			this.tokens.push(new Token("TK_STRING", str, this.last_pos, position));
		else
			this.errors.push(new BaseError("MissingExpextedError", "\"", this.last_pos, position));
	}

	get_String2() {
		let str = "";
		let position = this.current_pos.clone();
		this.advance();
		let has_slash = false;
		let ended = false;


		while (!this.is_EOF()) {
			position = this.current_pos.clone();
			if (this.current === '\\') {
				if (has_slash) {
					str += this.current;
					has_slash = false;
				}
				else {
					str += '\\';
					has_slash = true;
				}
			}
			else if (this.current === '\'') {
				if (has_slash) {
					str += '\'';
					has_slash = false;
				}
				else {
					ended = true;
					this.advance();
					break;
				}
			}
			else {
				has_slash = false;
				if (this.current === '\n')
					// str += '\\n';
					str += '\n';
				else if (this.current === '\t')
					str += '\t';
				else
					str += this.current;
			}
			this.advance();
		}

		if (ended)
			this.tokens.push(new Token("TK_STRING", str, this.last_pos, position));
		else
			this.errors.push(new BaseError("MissingExpextedError", "'", this.last_pos, position));
	}

	skip_Comment() {
		let comment = "";

		while (!this.is_EOF() && this.current !== '\n') {
			comment += this.current;
			this.advance();
		}

		// LexerCommentError *errorptr = new LexerCommentError(this.last_pos, this.current_pos, comment);
		// this.errors.push(errorptr);
		this.advance();
	}

	tokenize() {
		this.advance();
		while (!this.is_EOF()) {
			this.last_pos.copy(this.current_pos);
			// space
			if (this.current === ' ') {
				this.advance();
			}
			// space
			else if (this.current === '\t') {
				// this.tokens.push(new Token("TK_TAB", "\t", this.last_pos, this.current_pos));
				this.advance();
			}
			// newline
			else if (this.current === '\n') {
				// this.tokens.push(new Token("TK_NEWLINE", "\n", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === ',') {
				this.tokens.push(new Token("TK_COMMA", ",", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '.') {
				this.tokens.push(new Token("TK_DOT", ".", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '"') {
				this.get_String();
			}
			// else if (this.current === '\'') {
			// 	this.get_String2();
			// }
			// + - -> * /
			else if (this.current === '+') {
				this.tokens.push(new Token("TK_ADD", "+", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '-') {
				// ->
				if (this.peek() === '>') {
					this.advance();
					this.tokens.push(new Token("TK_TO", "->", this.last_pos, this.current_pos));
				}
				// -
				else
					this.tokens.push(new Token("TK_MINUS", "-", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '*') {
				this.tokens.push(new Token("TK_MULTIPIY", "*", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '/') {
				this.tokens.push(new Token("TK_DIVIDE", "/", this.last_pos, this.current_pos));
				this.advance();
			}
			// else if (this.current === '%') {
			// 	this.tokens.push(new Token("TK_MOD", "%", this.last_pos, this.current_pos));
			// 	this.advance();
			// }
			else if (this.current === ':') {
				let character = this.peek()
				if (character === '=') {
					this.advance();
					this.tokens.push(new Token("TK_BECOME", ":=", this.last_pos, this.current_pos));
				}
				// -
				else
					this.tokens.push(new Token("TK_TYPEDEFINE", ":", this.last_pos, this.current_pos));
				// this.errors.push(new BaseError("InvalidCharError", `: will always followed by '=' but now is '${character}'`, this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === ';') {
				this.tokens.push(new Token("TK_END", ";", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '=') {
				// ===
				if (this.peek() === '=') {
					this.advance();
					this.tokens.push(new Token("TK_EQUAL", "==", this.last_pos, this.current_pos));
				}
				// =
				else
					this.tokens.push(new Token("TK_ASSIGN", "=", this.last_pos, this.current_pos));
				this.advance();
			}

			else if (this.current === '[') {
				this.tokens.push(new Token("TK_LSQR", "[", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === ']') {
				this.tokens.push(new Token("TK_RSQR", "]", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '(') {
				this.tokens.push(new Token("TK_LCIR", "(", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === ')') {
				this.tokens.push(new Token("TK_RCIR", ")", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '<') {
				// ===
				if (this.peek() === '=') {
					this.advance();
					this.tokens.push(new Token("TK_LESSE", "<=", this.last_pos, this.current_pos));
				}
				else if (this.peek() === '>') {
					this.advance();
					this.tokens.push(new Token("TK_NOTEQUAL", "<>", this.last_pos, this.current_pos));
				}
				// =
				else
					this.tokens.push(new Token("TK_LESS", "<", this.last_pos, this.current_pos));
				this.advance();
			}
			else if (this.current === '>') {
				// ===
				if (this.peek() === '=') {
					this.advance();
					this.tokens.push(new Token("TK_GREATERE", ">=", this.last_pos, this.current_pos));
				}
				// =
				else
					this.tokens.push(new Token("TK_GREATER", ">", this.last_pos, this.current_pos));
				this.advance();
			}
			// else if (this.current === '{') {
			// 	this.tokens.push(new Token("TK_LBRACE", "{", this.last_pos, this.current_pos));
			// 	this.advance();
			// }
			// else if (this.current === '}') {
			// 	this.tokens.push(new Token("TK_RBRACE", "}", this.last_pos, this.current_pos));
			// 	this.advance();
			// }
			// else if (this.current === '!') {
			// 	// !=
			// 	if (this.peek() === '=') {
			// 		this.tokens.push(new Token("TK_NOTEQUAL", "!=", this.last_pos, this.current_pos));
			// 		this.advance();
			// 	}
			// 	else {
			// 		let character = "";
			// 		character += this.current;
			// 		this.errors.push(new BaseError("InvalidCharError", character, this.last_pos, this.current_pos));
			// 	}
			// 	this.advance();
			// }
			else if (this.current === '#') {
				this.skip_Comment();
			}
			// number
			else if (this.is_NumberChar(this.current)) {
				this.get_Number();
			}
			// identifier
			else if (this.is_IdentifierChar(this.current)) {
				this.get_Identifier();
			}
			else {
				let character = "";
				character += this.current;
				this.errors.push(new BaseError("InvalidCharError", character, this.last_pos, this.current_pos));
				this.advance();
			}
		}

		this.tokens.push(new Token("TK_EOF", "EOF", this.current_pos, this.current_pos));
	}
}

Set.prototype.intersect = function (a) {
	return new Set([...a].filter(x => this.has(x)));
}

Set.prototype.difference = function (a) {
	return new Set([...a].filter(x => !this.has(x)));
}

Set.prototype.equal = function (a) {
	return this.difference(a).size === 0 && a.difference(this).size === 0;
}

Array.prototype.in = function (a) {
	for (let idx = 0; idx < this.length; idx++) {
		if (this[idx].equal(a)) return idx;
	}
	return -1;
}

// DFA
export class DFA {
	constructor(start, transform, end) {
		this.path = {

		};
		this.accept = new Set();
		this.start = new Set(start);
		this.end = new Set(end);
		this.states = new Set([...this.start, ...this.end]);
		transform.forEach((t) => {
			this.states.add(t[0]);
			if (this.path[t[0]] === undefined) {
				this.path[t[0]] = {};
			}
			t[1].forEach((i) => {
				if (i[0] !== '$') this.accept.add(i[0]);
				if (this.path[t[0]][i[0]] === undefined) {
					this.path[t[0]][i[0]] = [i[1]];
				}
				else {
					this.path[t[0]][i[0]].push(i[1]);
				}
			})
		})
	}

	$_closure(node) {
		let ans = new Set;
		let nodes;
		if (node instanceof Set || node instanceof Array) {
			nodes = [...node];
		}
		else {
			nodes = [node];
		}
		nodes.forEach(i => ans.add(i));
		let tested = new Set;
		while (nodes.length > 0) {
			let n = nodes.pop();
			tested.add(n);
			if (this.path[n] !== undefined) {
				if (this.path[n]['$'] !== undefined) {
					this.path[n]['$'].forEach((i) => {
						ans.add(i);
						if (!tested.has(i)) {
							nodes.push(i);
						}
					})
				}
			}
		}
		return ans;
	}

	move(node, move) {
		let ans = new Set;
		let nodes;
		if (node instanceof Set || node instanceof Array) {
			nodes = [...node];
		}
		else {
			nodes = [node];
		}
		nodes.forEach((n) => {
			if (this.path[n] !== undefined) {
				if (this.path[n][move] !== undefined) {
					this.path[n][move].forEach((i) => {
						ans.add(i);
					})
				}
			}
		})
		return ans;
	}

	states() {
		let mid = [];
		for (let key in this.path) {
			mid.push(key);
		}
		return Array.from(new Set([...this.start, ...mid, ...this.end]));
	}

	// is_Deterministic() {
	// 	if (this.start.length > 1) return false;
	// 	let ans = true;
	// 	this.path.forEach((p)=>{
	// 		p
	// 	})
	// }

	toString() {
		let str = "graph LR;\n";
		this.end.forEach((s) => {
			str += `  ${s}((${s}))\n`;
		})
		for (let key in this.path) {
			for (let a in this.path[key]) {
				this.path[key][a].forEach((to) => {
					str += `  ${key}--${a === '$' ? 'ɛ' : a}-->${to}\n`
				})
			}
		}
		str += '  $Start((Start))\n';
		this.start.forEach((s) => {
			str += `  $Start-->${s}\n`;
		})

		return str;
	}

	regulate() {
		let table = [this.$_closure(this.start)];
		let count = 0;
		let accept = {};
		for (let i of this.accept) {
			accept[i] = []
		}
		while (count < table.length) {
			for (let i of this.accept) {
				let closure = this.$_closure(this.move(table[count], i));
				// console.log(table, closure)
				if (closure.size === 0) {
					accept[i].push(-1);
					continue;
				}
				let idx = table.in(closure);

				// console.log(idx);
				if (idx === -1) {
					table.push(closure);
					accept[i].push(table.length - 1);
				}
				else
					accept[i].push(idx);
			}
			count++;
		}
		let start = new Set([0]);
		let transform = [];
		let end = new Set;
		console.log(accept)
		table.forEach((s, i) => {
			let path = [];
			this.end.forEach(e => {
				if (s.has(e))
					end.add(i);
			})
			this.accept.forEach(a => {
				if (accept[a][i] === -1) return
				path.push([a, accept[a][i]])
			})
			transform.push([i, path]);
		})
		this.start = start;
		this.end = end;
		this.path = {};
		this.states = new Set([...this.start, ...this.end]);
		transform.forEach((t) => {
			this.states.add(t[0]);
			if (this.path[t[0]] === undefined) {
				this.path[t[0]] = {};
			}
			t[1].forEach((i) => {
				if (i[0] !== '$') this.accept.add(i[0]);
				if (this.path[t[0]][i[0]] === undefined) {
					this.path[t[0]][i[0]] = [i[1]];
				}
				else {
					this.path[t[0]][i[0]].push(i[1]);
				}
			})
		})
	}
}

// let dfa = new DFA("A", [
// 	["A", [[1, "B"]]],
// 	["B", [[1, "C"], [1, "B"], [0, "B"]]],
// 	["C", [[0, "D"]]],
// 	["D", [[1, "E"]]]
// ], "E")
// let dfa = new DFA("0", [
// 	["0", [['a', "0"],
// 	['a', "1"],
// 	['b', "1"]]],
// 	["1", [["a", "0"]]]
// ], "0")
let dfa = new DFA("A", [
	["A", [['$', "B"]]],
	["B", [
		['0', "B"],
		['1', "B1"]
	]],
	["B1", [['0', "B"]]],
	["B", [['$', "C"]]]
], "C")
console.log(dfa.toString())
dfa.regulate();
console.log(dfa.toString())

// sPARks
const TOKEN_CMP = (a, b) => {
	return a.equal(b)
}

Array.prototype.add = function (item, cmpfunc = TOKEN_CMP) {
	for (let i = 0; i < this.length; i++) {
		let ans = cmpfunc(item, this[i]);
		if (ans) return this;
	}
	this.push(item);
	return this;
}

Array.prototype.has = function (item, cmpfunc = TOKEN_CMP) {
	for (let i = 0; i < this.length; i++) {
		let ans = cmpfunc(item, this[i]);
		if (ans) return true;
	}
	return false;
}

Array.prototype.union = function (arr, cmpfunc = TOKEN_CMP) {
	for (let i = 0; i < arr.length; i++) {
		if (!this.has(arr[i], cmpfunc)) this.push(arr[i]);
	}
	return this;
}

export class SPARK_Error {
	constructor(type = "Error", msg = "", idx, last) {
		this.type = type;
		this.message = msg;
		this.start = idx.start.clone();
		this.end = idx.end.clone();
		this.last = last;
	}
}

export class Language {
	constructor(name, bnf, starter) {
		this.name = name;
		this.starter = starter;
		this.$PassChecking = true;
		this.$Terms = {};
		this.$First = {};
		this.$Follow = {};
		this.$Select = {};
		this.$Empty = {};
		for (let key in bnf) {
			this.registe(key, bnf[key]);
		}
		this.check();
		if (this.$PassChecking)
			this.get_FollowSet(this.starter);
	}
	print() {
		console.log(`Language ${this.name}`);
		function get_Front(c) {
			let str = "";
			for (let i = 0; i < c; i++) {
				str += ' ';
			}
			return str;
		}
		let size = 0;
		for (let key in this.$Terms) {
			size = Math.max(size, key.length);
		}
		for (let key in this.$Terms) {
			let term = this.$Terms[key]();
			if (term instanceof ChooseOne) {
				console.log(get_Front(size - key.length) + key + ' ::= ' + term.subs[0].toString());
				term.subs.slice(1, term.length).forEach(s => {
					console.log(get_Front(size) + '   | ' + s.toString());
				})
			}
			else
				console.log(get_Front(size - key.length) + key + ' ::= ' + term.toString());
		}
	}

	check() {
		for (let key in this.$Terms) {
			try {
				let term = this.$Terms[key]();
				term.check(key, `   *${key}*`, undefined, this);
			}
			catch (err) {
				this.$PassChecking = false;
				console.error(err.message)
			}
		}
	}

	get(term_name) {
		if (this.$Terms[term_name] === undefined) {
			throw Error(`<sPARks> node error: term name "${term}" is not defined`);
		}
		else {
			return this.$Terms[term_name]();
		}
	}

	registe(term_name, match) {
		if (this.$Terms[term_name] !== undefined) {
			throw Error(`<sPARks> node error: term name "${term_name}" has been already defined`);
		}
		else {
			this.$Terms[term_name] = match;
			this.$Follow[term_name] = [];
			this.$First[term_name] = [];
			this.$Select[term_name] = [];
			this.$Empty[term_name] = false;
		}
	}

	match(tokens) {
		let term_name = this.starter;
		if (this.$Terms[term_name] === undefined) {
			throw Error(`<sPARks> error: term name "${term}" is not defined in language ${this.name}`);
		}
		else {
			return (this.$Terms[term_name]()).match(tokens, 0, this);
		}
	}

	get_FirstSet() {
		if (!this.$PassChecking) throw new Error(`<sPARks> error: language ${this.name}'s rules contains left recusion, please remove those rules and try again`)
		let ans = {};
		for (let key in this.$Terms) {
			let a = [];
			let can_empty = this.get(key).get_First(a, this);
			// console.log(`First(${key})` + " >>", !can_empty, "\t", `${a.map(i => `${i.type}:${i.value}`).join(' ')}`);
			if (!can_empty) a.add(new Token('$e', '$e'));
			this.$Empty[key] = !can_empty;
			ans[key] = a;
		}
		this.$First = ans;
	}

	$get_Follow1(term) {
		let ans = [];
		for (let key in this.$Terms) {
			this.get(key).get_Follow(term, ans, undefined, this);
		}
		this.$Follow[term].union(ans);
		return ans;
	}

	$get_Follow2(term) {
		let lastlen = this.$Follow[term].length;
		let newlen = lastlen;
		for (let key in this.$Terms) {
			let can_reach = this.get(key).get_Follow2(term, undefined, this);
			// console.log(key, "->", term, can_reach)
			if (can_reach) {
				this.$Follow[term].union(this.$Follow[key]);
				newlen = this.$Follow[term].length;
			}
		}
		return newlen !== lastlen;
	}

	get_FollowSet(term) {
		if (!this.$PassChecking) throw new Error(`<sPARks> error: language ${this.name}'s rules contains left recusion, please remove those rules and try again`)
		this.get_FirstSet();
		this.$Follow[term].add(new Token("$#", "$#"));
		for (let key in this.$Terms) {
			this.$get_Follow1(key);
		}
		let change = true;
		while (change) {
			change = false;
			for (let key in this.$Terms) {
				let ans = this.$get_Follow2(key);
				if (ans) change = true;
			}
		}
	}

	get_SelectSet() {
		function $get_Select(match, term, l) {
			let a = [];
			if (!match.get_First(a, l)) {
				a.union(l.$Follow[term])
				return a;
			}
			else {
				return a;
			}
		}

		for (let key in this.$Terms) {
			let term = this.get(key);
			if (term instanceof ChooseOne) {
				term.subs.forEach((t) => {
					this.$Select[key].push({ term: t, set: $get_Select(t, key, this) })
				})
			}
			else if (term instanceof Once_or_None || term instanceof More_or_None) {
				if (term.subs instanceof ChooseOne) {
					term.subs.subs.forEach((t) => {
						this.$Select[key].push({ term: t, set: $get_Select(t, key, this) })
					})
				}
				else {
					this.$Select[key].push({ term: term.subs, set: $get_Select(term.subs, key, this) })
				}
				this.$Select[key].push({ term: new Skip(), set: this.$Follow[key] })
			}
		}
	}
}

export class Match {
	constructor(subs = [], match_func) {
		this.subs = subs;
		if (match_func === undefined) this.match_func = () => { return undefined }
		else this.match_func = typeof (match_func) !== "string" ? match_func : ((match, token) => {
			console.log("Match AST", match.nodes)
			if (match.nodes === undefined || match.nodes.length === 0) return undefined;
			let astnode = {}
			match.nodes.forEach((n) => {
				if (n[1] instanceof Array) {
					if (n[1].length === 0) return;
					console.log(n[1], n[1].map(i => i[1]))
					if (astnode[n[0]] !== undefined) {
						if (astnode[n[0]] instanceof Array)
							astnode[n[0]] = [...astnode[n[0]], ...(n[1].map(i => i[1]))]
						else astnode[n[0]] = [astnode[n[0]], ...(n[1].map(i => i[1]))]
					}
					else {
						astnode[n[0]] = n[1].map(i => i[1])
					}
				}
				else {
					if (astnode[n[0]] !== undefined) {
						throw new Error(`AST Error found dupilcate terms ${match_func}`)
					}
					else
						astnode[n[0]] = n[1]
				}
			})
			return [match_func, astnode]
		})
		this.nodes = [];
	}

	toString() {
		return this.term_name || `(${this.subs.map(i => i.toString()).join(' ')})`
	}

	match(tokens, idx = 0, language) {
		let $idx = idx
		this.nodes = [];
		let oldidx = idx;
		let ans, nextidx, node, error, erroridx = undefined;
		for (let i = 0; i < this.subs.length; i++) {
			[ans, nextidx, node, error, erroridx] = this.subs[i].match(tokens, idx, language);
			if (!ans) {
				// console.log(`expected ${this.subs[i].toString()} but found ${tokens[nextidx].value}`)
				return [false, oldidx, undefined, new SPARK_Error('MissingExpectedError', `expected ${this.subs[i].toString()}\nbut found ${tokens[nextidx].value}`, tokens[nextidx], error), erroridx];
			}
			else if (node !== undefined)
				this.nodes.push(node);
			idx = nextidx;
		}
		let ast = this.match_func(this, undefined)
		if (ast !== undefined && (ast[1].$start === undefined && ast[1].$end === undefined) && $idx === idx) {
			ast[1].$start = tokens[$idx].start
			ast[1].$end = tokens[$idx].start
			ast[1].$startidx = $idx
			ast[1].$endidx = $idx
		}
		if (ast !== undefined && (ast[1].$start === undefined && ast[1].$end === undefined)) {
			ast[1].$start = tokens[$idx].start
			ast[1].$end = tokens[idx - 1].end
			ast[1].$startidx = $idx
			ast[1].$endidx = idx - 1
		}
		return [true, idx, ast, undefined, undefined];
	}

	check(term_name, expanded, traveled = [], language) {
		this.subs[0].check(term_name, [expanded, `<Match>\t\t\tfirst of ${this.toString()}`].join(" \n-> "), traveled, language);
	}

	get_First(last = [], language) {
		let ans = false;
		for (let i = 0; i < this.subs.length; i++) {
			ans = this.subs[i].get_First(last, language);
			if (ans) break;
		}
		return ans;
	}

	get_Follow(term, last = [], layer = 0, language) {
		// console.log(last)
		// console.log("In Match:", this.toString(), term)
		for (let i = 0; i < this.subs.length; i++) {
			let match = this.subs[i];
			let find = match.get_Follow(term, last, layer + 1, language);
			if (find) {
				if (i + 1 === this.subs.length) {
					// console.log(get_Layer(layer), ">>>>>> last")
					return true;
				}
				else {
					let ans = [];
					this.subs[i + 1].get_First(ans, language);
					last.union(ans);
					return false;
				}
			}
		}
		return false;
	}

	get_Follow2(term, layer = 0, language) {
		// console.log(get_Layer(layer), "In Match:", this.toString())
		for (let i = 0; i < this.subs.length; i++) {
			let match = this.subs[i];
			let find = match.get_Follow2(term, layer + 1, language);
			if (find) {
				if (i + 1 === this.subs.length) {
					// console.log(get_Layer(layer), ">>>>>> last")
					return true;
				}
				else {
					// console.log(get_Layer(layer), ">>>>>> add")
					let ans = this.subs[i + 1].get_First([], language);
					return !ans;
				}
			}
		}
		return false;
	}

	reach(term, language) {
		for (let i = 0; i < this.subs.length; i++) {
			let match = this.subs[i];
			let find = match.reach(term, language);
			if (find) {
				return true;
			}
		}
		return false;
	}
}

export class Once_or_None extends Match {
	constructor(subs, returnundefinded = false) {
		super(undefined, undefined);
		if (subs.length === 1) {
			this.subs = subs[0];
			this.returnundefinded = returnundefinded;
		}
		else {
			throw Error('<sPARks> node error: "Once_or_None" node only accept one sub node')
		}
	}

	toString() {
		return `[${this.subs.toString()}]`
	}

	match(tokens, idx = 0, language) {
		let [ans, nextidx, node, error, erroridx] = this.subs.match(tokens, idx, language);
		// if (erroridx > idx) console.log(">>>> error", idx, erroridx, error.message)
		if (ans) {
			return [true, nextidx, node, error, erroridx];
		}
		else if (erroridx > idx) {
			return [false, idx, undefined, error, erroridx]
		}
		return [true, idx, this.returnundefinded ? ['null', null] : undefined, error, erroridx];
	}

	check(term_name, expanded, traveled = [], language) {
		this.subs.check(term_name, [expanded, `<OnceOrNone>\t\t${this.toString()}`].join(" \n-> "), traveled, language);
	}

	get_First(last = [], language) {
		this.subs.get_First(last, language);
		return false;
	}

	get_Follow(term, last = [], layer = 0, language) {
		// console.log(get_Layer(layer), "In Once_or_None:", this.toString())
		return this.subs.get_Follow(term, last, layer + 1, language);
	}

	get_Follow2(term, layer = 0, language) {
		// console.log(get_Layer(layer), "In Once_or_None:", this.toString())
		return this.subs.get_Follow2(term, layer + 1, language);
	}

	reach(term, language) {
		return this.subs.reach(term, language);
	}
}

export class More_or_None extends Match {
	constructor(subs, match_func) {
		let func = typeof (match_func) !== "string" ? match_func : ((match, token) => {
			console.log("More_or_None AST", match.nodes)
			return [match_func, match.nodes]
		})
		super(undefined, func);
		if (subs.length === 1) {
			this.subs = subs[0];
		}
		else {
			throw Error('<sPARks> node error: "More_or_None" node only accept one sub node')
		}
	}

	toString() {
		return `{${this.subs.toString()}}`
	}

	match(tokens, idx = 0, language) {
		let $idx = idx
		this.nodes = [];
		let ans, nextidx = idx, node, error, erroridx = undefined;
		do {
			[ans, nextidx, node, error, erroridx] = this.subs.match(tokens, nextidx, language);
			// if (!ans) console.log(">>>>>>>> error", nextidx, erroridx, error.message)
			if (node !== undefined) {
				this.nodes.push(node);
			}
		} while (ans);

		// console.log(">>>", nextidx, erroridx);

		if (erroridx === nextidx) {
			let ast = this.match_func(this, undefined)
			if (ast !== undefined) {
				ast[1].$start = tokens[$idx]
				ast[1].$end = tokens[nextidx - 1]
				ast[1].$startidx = $idx
				ast[1].$endidx = nextidx - 1
			}
			return [true, nextidx, ast, undefined, undefined];
		}
		else {
			let ast = this.match_func(this, undefined)
			if (ast !== undefined) {
				ast[1].$start = tokens[$idx]
				ast[1].$end = tokens[nextidx - 1]
				ast[1].$startidx = $idx
				ast[1].$endidx = nextidx - 1
			}
			return [false, nextidx, ast, error, erroridx];
		}
	}

	check(term_name, expanded, traveled = [], language) {
		this.subs.check(term_name, [expanded, `<MoreOrNone>\t\t${this.toString()}`].join(" \n-> "), traveled, language);
	}

	get_First(last = [], language) {
		this.subs.get_First(last, language);
		return false;
	}

	get_Follow(term, last = [], layer = 0, language) {
		// console.log(get_Layer(layer), "In More_or_None:", this.toString())
		return this.subs.get_Follow(term, last, layer + 1, language);
	}

	get_Follow2(term, layer = 0, language) {
		// console.log(get_Layer(layer), "In More_or_None:", this.toString())
		return this.subs.get_Follow2(term, layer + 1, language);
	}

	reach(term, language) {
		return this.subs.reach(term, language);
	}
}

export class ChooseOne extends Match {
	constructor(subs, match_func) {
		super(subs, match_func);
	}

	toString() {
		return this.term_name || `(${this.subs.map(i => i.toString()).join(' | ')})`
	}

	match(tokens, idx = 0, language) {
		let matched = false
		let last_idx = idx
		let last_error_idx = idx
		let last_node = undefined
		let last_error = undefined
		for (let i = 0; i < this.subs.length; i++) {
			let [ans, nextidx, node, error, erroridx] = this.subs[i].match(tokens, idx, language);
			if (ans) {
				matched = true;
				if (last_idx < nextidx) {
					last_idx = nextidx
					last_node = node
				}
			}
			if (last_error_idx < erroridx) {
				// console.log(">>> error", last_error_idx, erroridx, error.message)
				last_error_idx = erroridx
				last_error = error
			}
		}
		if (matched)
			return [true, last_idx, last_node, undefined, undefined];
		else
			return [false, idx, undefined, new SPARK_Error('NoMatchingError', `needs ${this.toString()}\nbut no valid match`, tokens[last_idx], last_error), last_error_idx];
	}

	check(term_name, expanded, traveled = [], language) {
		this.subs.forEach((s) => {
			s.check(term_name, [expanded, `<ChooseOne>\t\twith ${this.toString()} select ${s.toString()}`].join(" \n-> "), traveled, language);
		})
	}

	get_First(last = [], language) {
		let ans = true;
		this.subs.forEach((s) => {
			let can = s.get_First(last, language)
			if (!can) ans = false;
		})
		return ans;
	}

	get_Follow(term, last = [], layer = 0, language) {
		let finded = false;
		for (let i = 0; i < this.subs.length; i++) {
			let match = this.subs[i];
			let find = match.get_Follow(term, last, layer + 1, language);
			if (find) {
				finded = true;
			}
		}
		return finded;
	}

	get_Follow2(term, layer = 0, language) {
		let finded = false;
		for (let i = 0; i < this.subs.length; i++) {
			let match = this.subs[i];
			let find = match.get_Follow2(term, layer + 1, language);
			if (find) {
				finded = true;
			}
		}
		return finded;
	}
}

export class MatchToken extends Match {
	constructor(token, value, match_func) {
		let func = typeof (match_func) !== "string" ? match_func : ((match, token) => {
			console.log("MatchToken AST", match.nodes)
			return [match_func, { type: match_func, datatype: token.type, value: token.value }]
		})
		super(undefined, func);
		this.token = token
		this.value = value
	}

	toString() {
		let token = this.value || `${TOKENS[this.token]}`
		if (['[', ']', '{', '}', '(', ')'].includes(token)) return `'${token}'`
		return token;
	}

	match(tokens, idx = 0, language) {
		let $idx = idx;
		let token = tokens[idx];
		if (token !== undefined) {
			if (token.type === this.token && (this.value === undefined || token.value === this.value)) {
				let ast = this.match_func(this, token)
				if (ast !== undefined && (ast[1].$start === undefined && ast[1].$end === undefined)) {
					ast[1].$start = tokens[$idx].start
					ast[1].$end = tokens[$idx].end
					ast[1].$startidx = $idx
					ast[1].$endidx = $idx
				}
				return [true, idx + 1, ast, undefined, undefined];
			}
			return [false, idx, undefined, new SPARK_Error('TokenUnmatchError', `expected ${this.value !== undefined ? this.value : TOKENS[this.token]}\nbut found ${token.value}`, token), idx];
		}
	}

	check() {
	}

	get_First(last = [], language) {
		last.add(new Token(this.token, this.value));
		return true;
	}

	get_Follow(term, last = [], layer = 0, language) {
		return false;
	}

	get_Follow2(term, layer, language) {
		return false;
	}

	reach(term, language) {
		return false;
	}
}

export class MatchTerm extends Match {
	constructor(term_name, returnundefinded = false) {
		super(undefined, undefined);
		this.term_name = term_name;
		this.returnundefinded = returnundefinded;
		this.checked = false;
	}

	toString() {
		return "< " + this.term_name + " >";
	}

	match(tokens, idx = 0, language) {
		let term;
		if (language === undefined)
			term = SPARK_get(this.term_name);
		else
			term = language.get(this.term_name);
		let [ans, nextidx, node, error, erroridx] = term.match(tokens, idx, language);
		if (!ans) {
			if (this.returnundefinded) {
				return [true, idx, [this.term_name, null], undefined];
			}
			// console.log(error)
			// if (error.type === 'GrammerError')
			// 	return [false, idx, undefined, error, erroridx];
			return [false, idx, undefined, new SPARK_Error("GrammerError", `in grammer < ${this.term_name} > found grammer error :\n${error.message}`, tokens[idx], error.last), erroridx];
		}
		else {
			// console.log(this.term_name, error)
			return [true, nextidx, node === undefined ? [this.term_name, null] : node, error, erroridx]
		}
	}

	check(term_name, expanded, traveled = [], language) {
		if (this.term_name === term_name) {
			throw Error(`<sPARks> grammer check error: left recusion found in <${term_name}> in path\n${expanded} `)
		}
		if (traveled.includes(this.term_name)) {
			throw Error(`<sPARks> grammer check error: left recusion appeared when checking <${term_name}>`)
		}
		else {
			let term;
			if (language === undefined)
				term = SPARK_get(this.term_name);
			else
				term = language.get(this.term_name);
			term.check(term_name, [expanded, `<Term>\t\t\t${this.toString()} expand`].join(" \n-> "), traveled.concat(this.term_name), language);
		}
	}

	get_First(last = [], language) {
		let term;
		if (language === undefined)
			term = SPARK_get(this.term_name);
		else
			term = language.get(this.term_name);
		let ans = term.get_First(last, language);
		return ans;
	}

	get_Follow(term, last = [], layer = 0, language) {
		// console.log(get_Layer(layer), ">>>>>>", term === this.term_name)
		if (term === this.term_name) return true;
	}

	get_Follow2(term, layer, language) {
		// console.log(get_Layer(layer), ">>>>>>", term === this.term_name)
		if (term === this.term_name) return true;
	}

	reach(term, language) {
		// console.log(">>>", this.term_name, term)
		if (term === this.term_name) return true;
		return false;
	}
}

export class Skip extends Match {
	constructor() {
		super(undefined, undefined);
	}

	toString() {
		return "epsilon";
	}

	match(tokens, idx = 0, language) {
		return [true, idx, undefined, undefined, undefined]
	}

	check() {
	}

	get_First(last = []) {
		return false;
	}

	get_Follow(term, last = [], layer) {
		return false;
	}

	reach(term) {
		return false;
	}
}

export const PL0 = function () {
	return new Language("PL/0", {
		'constdef': () => {
			return new Match([
				new MatchToken("TK_IDENTIFIER", undefined, (match, token) => { return ['value', { type: 'identifier', value: token.value }] }),
				new MatchToken("TK_ASSIGN", undefined),
				new ChooseOne([
					new MatchTerm('exp'),
					new MatchTerm('array')
				])
			], (match, token) => {
				return ['constdef', {
					type: 'constdef',
					identifier: match.nodes[0][1].value,
					value: match.nodes[1][1]
				}]
			})
		},

		'const': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "const"),
				new MatchTerm("constdef"),
				new More_or_None([
					new Match([
						new MatchToken("TK_COMMA", undefined),
						new MatchTerm("constdef")
					], (match, token) => {
						return ['constdef', match.nodes[0]]
					})
				], (match, token) => { return ['constdefs', match.nodes] }),
				new MatchToken("TK_END", undefined)
			], (match, token) => {
				let arr = [match.nodes[0][1]]
				arr = arr.concat(match.nodes[1][1].map((i) => {
					return i[1][1]
				}))
				return ['const', {
					type: 'const',
					consts: arr
				}]
			})
		},

		'type': () => {
			return new Match([
				new ChooseOne([
					new MatchToken('TK_KEYWORD', "int", (match, token) => { return ['type', { type: 'type', value: 'int' }] }),
					new MatchToken('TK_KEYWORD', "real", (match, token) => { return ['type', { type: 'type', value: 'real' }] }),
					new MatchToken('TK_KEYWORD', "string", (match, token) => { return ['type', { type: 'type', value: 'string' }] }),
				]),
				new Once_or_None([
					new Match([
						new MatchToken("TK_LSQR", undefined),
						new MatchToken("TK_INT", undefined, (match, token) => { return ['value', { type: 'value', datatype: 'int', value: token.value }] }),
						new MatchToken("TK_RSQR", undefined),
					], (match, token) => {
						return match.nodes[0]
					})
				], true)
			], (match, token) => {
				if (match.nodes[1][0] === 'null') return match.nodes[0]
				else return ['type', { type: 'arraytype', value: match.nodes[0][1].value, count: match.nodes[1][1].value }]
			})
		},

		'vardef': () => {
			return new Match([
				new MatchToken("TK_IDENTIFIER", undefined, (match, token) => { return ['value', { type: 'identifier', value: token.value }] }),
				new Match([
					new MatchToken("TK_TYPEDEFINE", undefined),
					new MatchTerm('type')
				], (match, token) => {
					return match.nodes[0]
				}),
				new Once_or_None([
					new Match([
						new MatchToken("TK_ASSIGN", undefined),
						new ChooseOne([
							new MatchTerm('exp'),
							new MatchTerm('array')
						])
					], (match, token) => {
						return match.nodes[0]
					})
				], true)
			], (match, token) => {
				return ['vardef', {
					type: 'vardef',
					typedef: match.nodes[1][1],
					identifier: match.nodes[0][1].value,
					default: match.nodes[2][1]
				}]
			})
		},

		'var': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "var"),
				new MatchTerm("vardef"),
				new More_or_None([
					new Match([
						new MatchToken("TK_COMMA", undefined),
						new MatchTerm("vardef")
					], (match, token) => {
						return ['identifier', match.nodes[0]]
					})
				], (match, token) => { return ['identifiers', match.nodes] }),
				new MatchToken("TK_END", undefined)
			], (match, token) => {
				let arr = [match.nodes[0][1]]
				arr = arr.concat(match.nodes[1][1].map((i) => {
					return i[1][1]
				}))
				return ['var', {
					type: 'var',
					vars: arr
				}]
			})
		},

		'fact': () => {
			return new ChooseOne([
				new MatchToken("TK_INT", undefined, (match, token) => { return ['value', { type: 'value', datatype: 'int', value: token.value }] }),
				new MatchToken("TK_FLOAT", undefined, (match, token) => { return ['value', { type: 'value', datatype: 'real', value: token.value }] }),
				new MatchToken("TK_STRING", undefined, (match, token) => { return ['value', { type: 'value', datatype: 'string', value: token.value }] }),
				new Match([
					new MatchToken("TK_IDENTIFIER", undefined, (match, token) => { return ['value', { type: 'identifier', value: token.value }] }),
					new Once_or_None([
						new Match([
							new MatchToken("TK_LSQR", undefined),
							new MatchTerm('exp'),
							new MatchToken("TK_RSQR", undefined)], (match, tokens) => {
								return match.nodes[0]
							})
					], true)
				], (match, token) => {
					if (match.nodes[1][0] === 'null') {
						return match.nodes[0]
					}
					// console.log(">>>>>>>", match.nodes)
					return ['indexof', {
						type: 'indexof',
						identifier: match.nodes[0][1],
						index: match.nodes[1][1]
					}]
				}),
				new Match([
					new MatchToken("TK_LCIR", undefined),
					new MatchTerm("exp"),
					new MatchToken("TK_RCIR", undefined)
				], (match, token) => {
					return match.nodes[0]
				}),
				new Match([
					new ChooseOne([
						new MatchToken('TK_KEYWORD', "int", (match, token) => { return ['type', { type: 'type', value: 'int' }] }),
						new MatchToken('TK_KEYWORD', "real", (match, token) => { return ['type', { type: 'type', value: 'real' }] }),
						new MatchToken('TK_KEYWORD', "string", (match, token) => { return ['type', { type: 'type', value: 'string' }] })
					]),
					new MatchToken("TK_LCIR", undefined),
					new MatchTerm("exp"),
					new MatchToken("TK_RCIR", undefined)
				], (match, token) => {
					console.log(">>>>", match.nodes)
					return ["convert", {
						type: 'convert',
						value: match.nodes[1][1],
						to: match.nodes[0][1]
					}]
				})
			])
		},

		"term": () => {
			return new Match([
				new MatchTerm('fact'),
				new More_or_None([
					new Match([
						new ChooseOne([
							new MatchToken("TK_MULTIPIY", undefined, (match, token) => { return ['op', { type: 'binop', value: "*" }] }),
							new MatchToken("TK_DIVIDE", undefined, (match, token) => { return ['op', { type: 'binop', value: "/" }] })
						]),
						new MatchTerm('fact')
					], (match, token) => { return ['binop', match.nodes] })
				], (match, token) => { return ['binoptree', match.nodes] })
			], (match, token) => {
				let tree = match.nodes[1][1];
				let sub = match.nodes[0][1];
				let node = sub;
				if (tree.length === 0) {
					return match.nodes[0];
				}
				tree.forEach((op) => {
					let value = op[1][1][1];
					node = { type: 'binop', value: op[1][0][1].value, sub: [sub, value], $start: sub.$start, $end: value.$end, $startidx: sub.$startidx, $endidx: value.$endidx };
					sub = node;
				})
				return ['binop', node]
			})
		},

		"expfront": () => {
			return new Match([
				new Once_or_None([
					new ChooseOne([
						new MatchToken("TK_ADD", undefined, (match, token) => { return ['type', { type: 'binop', value: "+" }] }),
						new MatchToken("TK_MINUS", undefined, (match, token) => { return ['type', { type: 'binop', value: "-" }] })
					])
				]),
				new MatchTerm('term')
			], (match, token) => {
				if (match.nodes[0] && match.nodes[1])
					return ['uniop', { type: 'uniop', value: match.nodes[0][1].value, sub: [match.nodes[1][1]] }]
				else {
					return match.nodes[0]
				}
			})
		},

		"exp": () => {
			return new Match([
				new MatchTerm('expfront'),
				new More_or_None([
					new Match([
						new ChooseOne([
							new MatchToken("TK_ADD", undefined, (match, token) => { return ['op', { type: 'binop', value: "+" }] }),
							new MatchToken("TK_MINUS", undefined, (match, token) => { return ['op', { type: 'binop', value: "-" }] }),
						]),
						new MatchTerm('term')
					], (match, token) => { return ['binop', match.nodes] })
				], (match, token) => { return ['binoptree', match.nodes] })
			], (match, token) => {
				let tree = match.nodes[1][1];
				let sub = match.nodes[0][1];
				let node = sub;
				if (tree.length === 0) {
					return match.nodes[0];
				}
				tree.forEach((op) => {
					let value = op[1][1][1];
					node = { type: 'binop', value: op[1][0][1].value, sub: [sub, value], $start: sub.$start, $end: value.$end, $startidx: sub.$startidx, $endidx: value.$endidx };
					sub = node;
				})
				return ['binop', node]
			})
		},

		'array': () => {
			return new Match([
				new MatchToken("TK_LSQR", undefined),
				new MatchTerm("exp"),
				new More_or_None([
					new Match([
						new MatchToken("TK_COMMA", undefined),
						new MatchTerm("exp")
					], (match, token) => {
						return ['expression', match.nodes[0]]
					})
				], (match, token) => { return ['expressions', match.nodes] }),
				new MatchToken("TK_RSQR", undefined),
			], (match, token) => {
				// console.log(match.nodes)
				let arr = [match.nodes[0][1]]
				arr = arr.concat(match.nodes[1][1].map((i) => {
					return i[1][1]
				}))
				return ['array', {
					type: 'array',
					expressions: arr,
					count: arr.length
				}]
			})
		},

		'cmp': () => {
			return new ChooseOne([
				new MatchToken("TK_EQUAL", undefined, (match, token) => { return ['value', { type: 'binop', value: '==' }] }),
				new MatchToken("TK_NOTEQUAL", undefined, (match, token) => { return ['value', { type: 'binop', value: '!=' }] }),
				new MatchToken("TK_LESS", undefined, (match, token) => { return ['value', { type: 'binop', value: '<' }] }),
				new MatchToken("TK_GREATER", undefined, (match, token) => { return ['value', { type: 'binop', value: '>' }] }),
				new MatchToken("TK_LESSE", undefined, (match, token) => { return ['value', { type: 'binop', value: '<=' }] }),
				new MatchToken("TK_GREATERE", undefined, (match, token) => { return ['value', { type: 'binop', value: '>=' }] }),
			])
		},

		"cmpexp": () => {
			return new ChooseOne([
				new Match([
					new MatchTerm("exp"),
					new MatchTerm("cmp"),
					new MatchTerm("exp")
				], (match, token) => {
					return ['binop', {
						type: 'binop',
						value: match.nodes[1][1].value,
						sub: [
							match.nodes[0][1],
							match.nodes[2][1]
						]
					}]
				}),
				new Match([
					new MatchToken("TK_KEYWORD", 'odd'),
					new MatchTerm("exp")
				], (match, token) => {
					return ['binop', {
						type: 'uniop',
						value: 'not',
						sub: [
							match.nodes[0][1]
						]
					}]
				}),
			])
		},

		'states': () => {
			return new ChooseOne([
				new MatchTerm('assign'),
				new MatchTerm('if'),
				new MatchTerm('while'),
				new MatchTerm('call'),
				new MatchTerm('read'),
				new MatchTerm('write'),
				new MatchTerm('block'),
				// new Skip()
			])
		},

		'statment': () => {
			return new Once_or_None([
				new MatchTerm("states")
			])
		},

		'lvalue': () => {
			return new Match([
				new MatchToken("TK_IDENTIFIER", undefined, (match, token) => { return ['value', { type: 'identifier', value: token.value }] }),
				new Once_or_None([
					new Match([
						new MatchToken("TK_LSQR", undefined),
						new MatchTerm('exp'),
						new MatchToken("TK_RSQR", undefined)], (match, tokens) => {
							return match.nodes[0]
						})
				], true)
			], (match, token) => {
				if (match.nodes[1][0] === 'null') {
					return match.nodes[0]
				}
				// console.log(">>>>>>>", match.nodes)
				return ['indexof', {
					type: 'indexof',
					identifier: match.nodes[0][1],
					index: match.nodes[1][1]
				}]
			})
		},

		"assign": () => {
			return new Match([
				new MatchTerm("lvalue"),
				new MatchToken("TK_BECOME", undefined),
				new MatchTerm('exp')
			], (match, token) => {
				return ['assign', {
					type: 'assign',
					identifier: match.nodes[0][1],
					expression: match.nodes[1][1]
				}]
			})
		},

		'if': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "if"),
				new MatchTerm('cmpexp'),
				new MatchToken("TK_KEYWORD", "then"),
				new MatchTerm('statment'),
				new Once_or_None([
					new Match([
						new MatchToken("TK_KEYWORD", "else"),
						new MatchTerm('statment')
					], (match, token) => {
						if (match.nodes[0][1] === null) return undefined
						return match.nodes[0]
					})
				], true)
			], (match, token) => {
				return ['if', {
					type: 'if',
					expression: match.nodes[0][1],
					sub: [match.nodes[1][1]],
					else: [match.nodes[2] === undefined ? null : match.nodes[2][1]]
				}]
			})
		},

		'while': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "while"),
				new MatchTerm('cmpexp'),
				new MatchToken("TK_KEYWORD", "do"),
				new MatchTerm('statment'),
			], (match, token) => {
				return ['while', {
					type: 'while',
					expression: match.nodes[0][1],
					sub: [match.nodes[1][1]]
				}]
			})
		},

		'call': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "call"),
				new MatchToken("TK_IDENTIFIER", undefined, (match, token) => { return ['identifier', { type: 'identifier', value: token.value }] })
			], (match, token) => {
				return ['call', {
					type: 'call',
					identifier: match.nodes[0][1]
				}]
			})
		},

		'read': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "read"),
				new MatchToken("TK_LCIR", undefined),
				new MatchToken("TK_IDENTIFIER", undefined, (match, token) => { return ['identifier', { type: 'identifier', value: token.value }] }),
				new More_or_None([
					new Match([
						new MatchToken("TK_COMMA", undefined),
						new MatchToken("TK_IDENTIFIER", undefined, (match, token) => { return ['identifier', { type: 'identifier', value: token.value }] })
					], (match, token) => {
						return ['identifier', match.nodes[0]]
					})
				], (match, token) => { return ['identifiers', match.nodes] }),
				new MatchToken("TK_RCIR", undefined),
			], (match, token) => {
				// console.log(match.nodes)
				let arr = [match.nodes[0][1]]
				arr = arr.concat(match.nodes[1][1].map((i) => {
					return i[1][1]
				}))
				return ['read', {
					type: 'read',
					identifiers: arr
				}]
			})
		},

		'write': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "write"),
				new MatchToken("TK_LCIR", undefined),
				new MatchTerm("exp"),
				new More_or_None([
					new Match([
						new MatchToken("TK_COMMA", undefined),
						new MatchTerm("exp")
					], (match, token) => {
						return ['expression', match.nodes[0]]
					})
				], (match, token) => { return ['expressions', match.nodes] }),
				new MatchToken("TK_RCIR", undefined),
			], (match, token) => {
				// console.log(match.nodes)
				let arr = [match.nodes[0][1]]
				arr = arr.concat(match.nodes[1][1].map((i) => {
					return i[1][1]
				}))
				return ['write', {
					type: 'write',
					expressions: arr
				}]
			})
		},

		'block': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "begin"),
				new MatchTerm("statment"),
				new More_or_None([
					new Match([
						new MatchToken("TK_END", undefined),
						new MatchTerm("statment")
					], (match, token) => {
						// console.log(match.nodes)
						if (match.nodes[0][1] === null) return undefined
						return ['statment', match.nodes[0]]
					})
				], (match, token) => { return ['statments', match.nodes] }),
				new MatchToken("TK_KEYWORD", "end")
			], (match, token) => {
				// console.log(match.nodes)
				let arr = match.nodes[0][1] === null ? [] : [match.nodes[0][1]]
				arr = arr.concat(match.nodes[1][1].map((i) => {
					return i[1][1]
				}))
				return ['block', {
					type: 'block',
					statments: arr
				}]
			})
		},

		'proceduredef': () => {
			return new Match([
				new MatchToken("TK_KEYWORD", "procedure"),
				new MatchToken("TK_IDENTIFIER", undefined, (match, token) => { return ['identifier', { type: 'identifier', value: token.value }] }),
				new MatchToken("TK_END", undefined)
			], (match, token) => {
				return ['procdef', {
					type: 'procdef',
					identifier: match.nodes[0][1].value
				}]
			})
		},

		'procedure': () => {
			return new Match([
				new MatchTerm("proceduredef"),
				new MatchTerm("subprogram"),
				new MatchToken("TK_END", undefined)
			], (match, token) => {
				return ['proc', {
					type: 'proc',
					identifier: match.nodes[0][1],
					block: match.nodes[1][1],
				}]
			})
		},

		'subprogram': () => {
			return new Match([
				new More_or_None([
					new MatchTerm("const")
				], (match, token) => {
					return ['consts', match.nodes]
				}),
				new More_or_None([
					new MatchTerm("var")
				], (match, token) => {
					return ['vars', match.nodes]
				}),
				new More_or_None([
					new MatchTerm("procedure")
				], (match, token) => {
					return ['procs', match.nodes]
				}),
				new MatchTerm('statment')
			], (match, token) => {
				// console.log(match.nodes)
				return ['subprogram', {
					type: 'subprogram',
					consts: match.nodes[0][1].map(i => i[1]),
					vars: match.nodes[1][1].map(i => i[1]),
					procs: match.nodes[2][1].map(i => i[1]),
					subs: match.nodes[3][1]
				}]
			})
		},

		'program': () => {
			return new Match([
				new MatchTerm('subprogram'),
				new MatchToken("TK_DOT", undefined),
				new MatchToken("TK_EOF", undefined)
			], (match, token) => {
				return match.nodes[0]
			})
		}
	}, "program");
}

export const BasicCalculator = function () {
	return new Language("BasicCalculator", {
		AddMinus: () => {
			return new ChooseOne([
				new MatchToken("TK_ADD", undefined, () => {
					return ['op', { type: 'op', value: '+' }]
				}),
				new MatchToken("TK_MINUS", undefined, () => {
					return ['op', { type: 'op', value: '-' }]
				})
			])
		},
		PlusDivide: () => {
			return new ChooseOne([
				new MatchToken("TK_MULTIPIY", undefined, () => {
					return ['op', { type: 'op', value: '*' }]
				}),
				new MatchToken("TK_DIVIDE", undefined, () => {
					return ['op', { type: 'op', value: '/' }]
				})
			])
		},
		Expression: () => {
			return new Match([
				new MatchTerm("Term"),
				new MatchTerm("Expression$"),
			], (match) => {
				console.log(">> Expression", match.nodes)
				if (match.nodes[1][1] === null) {
					return match.nodes[0];
				}
				return ['binop', {
					type: 'binop',
					value: match.nodes[1][1].op.value,
					a: match.nodes[0][1],
					b: match.nodes[1][1].b,
				}]
			})
		},
		Expression$: () => {
			return new Once_or_None([
				new Match([
					new MatchTerm("AddMinus"),
					new MatchTerm("Term")
				], (match) => {
					console.log(">> Expression$", match.nodes)
					return ['subop', {
						type: 'subop',
						op: match.nodes[0][1],
						b: match.nodes[1][1]
					}]
				})
			])
		},
		Term: () => {
			return new Match([
				new MatchTerm("Primary"),
				new MatchTerm("Term$"),
			], (match) => {
				console.log(">> Term", match.nodes)
				if (match.nodes[1][1] === null) {
					return match.nodes[0];
				}
				return ['binop', {
					type: 'binop',
					value: match.nodes[1][1].op.value,
					a: match.nodes[0][1],
					b: match.nodes[1][1].b,
				}]
			})
		},
		Term$: () => {
			return new Once_or_None([
				new Match([
					new MatchTerm("PlusDivide"),
					new MatchTerm("Primary")
				], (match) => {
					console.log(">> Term$", match.nodes)
					return ['subop', {
						type: 'subop',
						op: match.nodes[0][1],
						b: match.nodes[1][1]
					}]
				})
			])
		},
		Primary: () => {
			return new ChooseOne([
				new MatchTerm("Number"),
				new Match([
					new MatchToken("TK_LCIR"),
					new MatchTerm("Expression"),
					new MatchToken("TK_RCIR")
				], (match) => {
					console.log(">> Primary", match.nodes)
					return match.nodes[0]
				})
			])
		},
		Number: () => {
			return new ChooseOne([
				new MatchToken("TK_INT", undefined, (match, token) => {
					return ['value', { type: 'value', datatype: 'int', value: token.value }]
				}),
				new MatchToken("TK_FLOAT", undefined, (match, token) => {
					return ['value', { type: 'value', datatype: 'float', value: token.value }]
				})
			])
		}
	}, "Expression")
}

Array.prototype.tab = function () {
	return this.join("\n").split('\n').map((i) => "    " + i).join('\n')
}

// Walker
function typeCheck(a, b) {
	// console.log(">>>>", a, b)
	if (a.type === b.type) {
		// console.log("match >>>>", a, b)
		if (a.type === 'type') return a.value === b.value;
		else if (a.type === 'arraytype') {
			return (a.value === b.value) && (a.count === b.count);
		}
	}
	else {
		return false;
	}
}

function typeToString(a) {
	if (a.type === "type") return a.value;
	else if (a.type === "arraytype") return `${a.value}[${a.count}]`;
	return "$unknown";
}

export const PL0Visitors = {
	subprogram: {
		walk(node, path) {
			path.$scope.new_Scope()
			return ["consts", "vars", "procs", "subs"]
		},
		transform(path) {
			path.$scope.exit_Scope()
			return path.node
		}
	},
	const: {
		walk(node) {
			// console.log(">>> consts visitor walk func")
			return ["consts"]
		},
		transform(path) {
			return path.node
		}
	},
	var: {
		walk(node) {
			return ["vars"]
		},
		transform(path) {
			return path.node
		}
	},
	vardef: {
		walk(node) {
			// console.log(node.typedef)
			return ["default", "typedef"]
		},
		transform(path) {
			let iden = new Identifier(path.node.identifier, "var", path.node, path.node.typedef)
			let [ans, old] = path.$scope.registe(iden)
			if (!ans) {
				let [str, starter, end] = path.$sourcescript.get_ScriptPortion(old.def.$start, old.def.$end, "~", "yellow")
				let reason = str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter}${end}</a><a style="color: yellow">last definition of ${old.def.identifier}</a>`
				return [path.node, new BaseError("VariableRedefinitionError", `\n${reason}\n\nwhen defining var <a style="color: rgb(0,255,0);">${path.node.identifier}</a>\nwhich has been already defined before`, path.$start, path.$end)]
			}
			if (path.node.default !== null)
				if (!typeCheck(path.node.default.typedef, path.node.typedef)) {
					let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.node.typedef.$start, path.node.typedef.$end, "~", "yellow")
					let [str, starter, end] = path.$sourcescript.get_ScriptPortion(path.node.default.$start, path.node.default.$end, "~", "yellow")
					let reason = str1 + `<a style="color: white">${starter1}${end1}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter1}${end1}</a>defined as <a style="color: yellow">${typeToString(path.node.typedef)}</a>` + '\n\n' + str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter}${end}</a>assigned with <a style="color: yellow">${typeToString(path.node.default.typedef)}</a>`
					return [path.node, new BaseError("TypeCheckError", `\n${reason}\n\nvariable <a style="color: rgb(0,255,0);">${path.node.identifier}</a> is type of ${typeToString(path.node.typedef)}\nbut its default value is type of ${typeToString(path.node.default.typedef)} which is not compatible`, path.$start, path.$end)]
				}
			return path.node
		}
	},
	arraytype: {
		walk(node) { },
		transform(path) {
			if (path.node.count <= 1) {
				// let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.$start, path.$end, "~", "yellow")
				// let reason = str1
				return [{ type: "type", value: path.node.value, $start: path.$start, $end: path.$end, $startpos: path.$startpos, $endpos: path.$endpos }, new BaseError("TypeCheckWarning", `size of an array should be bigger than 1\nthis will be assumed as <a style="color: rgb(0, 255,0);">${path.node.value}</a> type`, path.$start, path.$end, { color: 'orange' })]
			}
			return path.node
		}
	},
	constdef: {
		walk(node) {
			// console.log(">>> vardef visitor walk func", node)
			return ["value"]
		},
		transform(path) {
			// console.log(path.node)
			let iden = new Identifier(path.node.identifier, "const", path.node, path.node.value.typedef)
			let [ans, old] = path.$scope.registe(iden)
			if (!ans) {
				let [str, starter, end] = path.$sourcescript.get_ScriptPortion(old.def.$start, old.def.$end, "~", "yellow")
				let reason = str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter}${end}</a><a style="color: yellow">last definition of ${old.def.identifier}</a>`
				return [path.node, new BaseError("VariableRedefinitionError", `\n${reason}\n\nwhen defining var <a style="color: rgb(0,255,0);">${path.node.identifier}</a>\nwhich has been already defined before`, path.$start, path.$end)]
			}
			return path.node
		}
	},
	assign: {
		walk(node) {
			// console.log(">>> vardef visitor walk func", node)
			return ["identifier", "expression"]
		},
		transform(path) {
			console.log(path.node)
			if (path.node.identifier.typedef.value === '$unknown') return path.node
			if (path.node.identifier.$const) {
				let [str, starter, end] = path.$sourcescript.get_ScriptPortion(path.node.identifier.$start, path.node.identifier.$end, "~", "yellow")
				// console.log(str)
				let reason = str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter}${end}</a><a style="color: yellow">const</a>`
				return [path.node, new BaseError("TypeCheckError", `\n${reason}\n\nconst <a style="color: rgb(0,255,0);">${path.node.identifier.value}</a> can not be assigned`, path.$start, path.$end)]
			}
			if (path.node.identifier.typedef !== null && !typeCheck(path.node.expression.typedef, path.node.identifier.typedef)) {
				if (path.node.identifier.type === 'identifier') {
					let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.node.identifier.typedef.$start, path.node.identifier.typedef.$end, "~", "yellow")
					// console.log(str)
					let [str, starter, end] = path.$sourcescript.get_ScriptPortion(path.node.expression.$start, path.node.expression.$end, "~", "yellow")
					// console.log(str)
					let reason = str1 + `<a style="color: white">${starter1}${end1}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter1}${end1}</a>defined as <a style="color: yellow">${typeToString(path.node.identifier.typedef)}</a>` + '\n\n' + str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter}${end}</a>assigned with <a style="color: yellow">${typeToString(path.node.expression.typedef)}</a>`
					return [path.node, new BaseError("TypeCheckError", `\n${reason}\n\nvariable <a style="color: rgb(0,255,0);">${path.node.identifier.value}</a> is type of ${typeToString(path.node.identifier.typedef)} \ntype of ${typeToString(path.node.expression.typedef)} is not compatible`, path.$start, path.$end)]
				}
				else {
					let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.node.identifier.$start, path.node.identifier.$end, "~", "yellow")
					// console.log(str)
					let [str, starter, end] = path.$sourcescript.get_ScriptPortion(path.node.expression.$start, path.node.expression.$end, "~", "yellow")
					// console.log(str)
					let reason = str1 + `<a style="color: white">${starter1}${end1}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter1}${end1}</a>type of <a style="color: yellow">${typeToString(path.node.identifier.typedef)}</a>` + '\n\n' + str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter}${end}</a>assigned with <a style="color: yellow">${typeToString(path.node.expression.typedef)}</a>`
					return [path.node, new BaseError("TypeCheckError", `\n${reason}\n\nvariable <a style="color: rgb(0,255,0);">${path.node.identifier.identifier.value}[int]</a> is type of ${typeToString(path.node.identifier.typedef)} \ntype of ${typeToString(path.node.expression.typedef)} is not compatible`, path.$start, path.$end)]
				}
			}
			return path.node
		}
	},
	array: {
		walk: (node) => {
			return ["expressions"];
		},
		transform: (path) => {
			path.node.typedef = { type: 'arraytype', value: '$unknown', count: path.node.expressions.length };
			let firsttype = path.node.expressions[0].typedef;
			let remain = path.node.expressions.slice(1);
			let pass = true;
			for (let i = 0; i < remain.length; i++) {
				if (!typeCheck(firsttype, remain[i].typedef)) {
					pass = false;
					break;
				}
			}
			console.log(pass)
			if (!pass) {
				let reasons = path.node.expressions.map((s, i) => {
					let [str, starter, end] = path.$sourcescript.get_ScriptPortion(s.$start, s.$end, "~", "yellow")
					return str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">${typeToString(s.typedef)}</a>`
				})
				return [path.node, new BaseError("ArrayDefinitionError", `\n${reasons.join("\n")}\n\nan array can only contain value with the same type`, path.$start, path.$end)]
			}
			// console.log(pass, remain, path.node.expressions.length)
			path.node.typedef.value = firsttype.value;
			return path.node;
		}
	},
	proc: {
		walk(node) {

			return []
		},
		transform(path) {
			return path.node
		}
	},
	value: {
		walk() { },
		transform(path) {
			return {
				type: 'value',
				$immediate: true,
				typedef: { type: "type", value: path.node.datatype },
				value: path.node.value
			}
		}
	},
	identifier: {
		walk(node) {
		},
		transform(path) {
			let iden = path.$scope.get(path.node.value);
			if (iden === undefined) {
				path.node.identype = "$unknown";
				path.node.$const = false;
				path.node.typedef = { type: 'type', value: '$unknown' };
				path.node.def = undefined;
				return [path.node, new BaseError("IdentifierUndefinedError", `variable <a style="color: rgb(0,255,0);">${path.node.value}</a> is not defined in this scope`, path.$start, path.$end)]
			}
			else {
				path.node.identype = iden.type;
				path.node.$const = iden.type === 'const';
				path.node.typedef = iden.typedef;
				path.node.def = iden.def;
			}
			path.node.$immediate = false;
			return path.node;
		}
	},
	binop: {
		walk(node) {
			// console.log(">>> binop visitor walk func", node)
			return ["sub"]
		},
		transform(path) {
			// console.log(path.node)
			const BINOP = {
				'+': (a, b) => { return a + b },
				'-': (a, b) => { return a - b },
				'*': (a, b) => { return a * b },
				'/': (a, b) => { return a / b },
			}
			const TYPEMAP = {
				"int": (right) => {
					switch (right) {
						case "int": return "int";
						case "real": return "real";
						case "string": return "string";
						default: return "$unknown";
					}
				},
				"real": (right) => {
					switch (right) {
						case "int": return "real";
						case "real": return "real";
						case "string": return "string";
						default: return "$unknown";
					}
				},
				"string": (right) => {
					switch (right) {
						case "int": return "string";
						case "real": return "string";
						case "string": return "string";
						default: return "$unknown";
					}
				},
				"$unknown": (right) => {
					return "$unknown";
				}
			}
			let type = { type: 'type', value: '$unknown' };
			if (path.node.sub[0].typedef !== null && path.node.sub[1].typedef !== null) {
				type = { type: "type", value: TYPEMAP[path.node.sub[0].typedef.value](path.node.sub[1].typedef.value) };
			}
			if (path.node.sub[0].$immediate && path.node.sub[1].$immediate) {
				return {
					type: 'value',
					$immediate: true,
					typedef: type,
					value: BINOP[path.node.value](path.node.sub[0].value, path.node.sub[1].value)
				}
			}
			return {
				type: 'binop',
				value: path.node.value,
				$immediate: false,
				typedef: type,
				sub: path.node.sub
			}
		}
	},
	indexof: {
		walk: (node) => {
			console.log(node);
			return ["identifier", "index"];
		},
		transform: (path) => {
			path.node.typedef = { type: 'type', value: path.node.identifier.typedef.value, $start: path.node.identifier.typedef.$start, $end: path.node.identifier.typedef.$end };
			if (path.node.identifier.typedef.value === '$unknown') return path.node;
			if (path.node.identifier.typedef.type !== 'arraytype') {
				let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.node.identifier.typedef.$start, path.node.identifier.typedef.$end, "~", "yellow")
				let reason = str1 + `<a style="color: white">${starter1}${end1}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter1}${end1}</a>defined as <a style="color: yellow">${typeToString(path.node.identifier.typedef)}</a>`
				return [path.node, new BaseError("TypeCheckError", `\n${reason}\n\nvariable <a style="color: rgb(0,255,0);">${path.node.identifier.value}</a> is type of ${typeToString(path.node.identifier.typedef)}, not array`, path.$start, path.$end)]
			}
			else if (path.node.index.typedef.type !== "type" || path.node.index.typedef.value !== 'int') {
				let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.node.index.$start, path.node.index.$end, "~", "yellow")
				let reason = str1 + `<a style="color: white">${starter1}${end1}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter1}${end1}</a><a style="color: yellow">${typeToString(path.node.index.typedef)}</a>`
				return [path.node, new BaseError("TypeCheckError", `\n${reason}\n\nindex of an array should be <a style="color: rgb(0,255,0);">int</a>`, path.$start, path.$end)]
			}
			else if (path.node.index.$immediate && (path.node.index.value < 0 || path.node.index.value >= path.node.identifier.typedef.count)) {
				let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.node.index.$start, path.node.index.$end, "~", "yellow")
				let reason = str1
				return [path.node, new BaseError("ArrayAccessOutOfBoundError", `\n${reason}\nindex of an array should meet <a style="color: rgb(0,255,0);">0 <= </a>index <a style="color: rgb(0,255,0);"><= ${path.node.identifier.typedef.count - 1}</a>`, path.$start, path.$end)]
			}
			return path.node;
		}
	},
	convert: {
		walk(node) {
			return ['value']
		},
		transform(path) {
			path.node.typedef = { type: 'type', value: '$unknown' };
			if (path.node.value.typedef.type !== 'type') {
				let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.node.value.$start, path.node.value.$end, "~", "yellow")
				let reason = str1 + `<a style="color: white">${starter1}${end1}<a style="color: yellow">${typeToString(path.node.value.typedef)}</a>`
				return [path.node, new BaseError("CanNotCastError", `\n${reason}\n\nexpression is type of ${typeToString(path.node.value.typedef)}\nonly atom type <a style="color: rgb(0,255,0)">int</a>/<a style="color: rgb(0,255,0)">real</a>/<a style="color: rgb(0,255,0)">string</a> can be casted`, path.$start, path.$end)]
			}
			// if (path.node.value.typedef.value === '$unknown' ){
			// 	let [str1, starter1, end1] = path.$sourcescript.get_ScriptPortion(path.node.identifier.typedef.$start, path.node.identifier.typedef.$end, "~", "yellow")
			// 	let reason = str1 + `<a style="color: white">${starter1}${end1}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter1}${end1}</a>defined as <a style="color: yellow">${typeToString(path.node.identifier.typedef)}</a>`
			// 	return [path.node, new BaseError("TypeCheckError", `\n${reason}\n\nvariable <a style="color: rgb(0,255,0);">${path.node.identifier.value}</a> is type of ${typeToString(path.node.identifier.typedef)}, not array`, path.$start, path.$end)]
			// }
			// if (path.node.value.$immediate === true) {

			// }
			path.node.$immediate = false;
			path.node.typedef = path.node.to;
			return path.node
		}
	},
	proc: {
		walk(node) {
			return ["block"]
		},
		transform(path) {
			let iden = new Identifier(path.node.identifier.identifier, "procedure", path.node, path.node.typedef)
			let [ans, old] = path.$scope.registe(iden)
			if (!ans) {
				let [str, starter, end] = path.$sourcescript.get_ScriptPortion(old.def.$start, old.def.$end, "~", "yellow")
				let reason = str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter}${end}</a><a style="color: yellow">last definition of ${old.def.identifier}</a>`
				return [path.node, new BaseError("IdentifierRedefinitionError", `\n${reason}\n\nwhen defining procedure <a style="color: rgb(0,255,0);">${path.node.identifier.identifier}</a>\nwhich has been already used before`, path.node.identifier.$start, path.node.identifier.$end)]
			}
			return path.node
		}
	},
	block: {
		walk(node) {
			return ["statments"]
		},
		transform(path) {
			return path.node
		}
	},
	if: {
		walk(node) {
			// console.log(node)
			return ["sub", "else"]
		},
		transform(path) {
			return path.node
		}
	},
	while: {
		walk(node) {
			// console.log(node)
			return ["sub"]
		},
		transform(path) {
			return path.node
		}
	},
	call: {
		walk(node) {
			return ["identifier"]
		},
		transform(path) {
			if (path.node.identifier.identype === '$unknown') return path.node;
			console.log(path.node.identifier)
			if (path.node.identifier.identype !== 'procedure') {
				let [str, starter, end] = path.$sourcescript.get_ScriptPortion(path.node.identifier.def.$start, path.node.identifier.def.$end, "~", "yellow")
				let reason = str + `<a style="color: white">${starter}${end}</a><a style="color: yellow">|</a>\n<a style="color: white">${starter}${end}</a><a style="color: yellow">definition of ${path.node.identifier.value}</a>`
				return [path.node, new BaseError("UnmatchedProcedureError", `\n${reason}\n\nwhen calling procedure <a style="color: rgb(0,255,0);">${path.node.identifier.value}</a>\nwhich is not a callable procedure`, path.node.identifier.$start, path.node.identifier.$end)]
			}
			return path.node
		}
	},
	write: {
		walk(node) {
			return ["expressions"]
		},
		transform(path) {
			return path.node
		}
	},
	read: {
		walk(node) {
			return ["identifiers"]
		},
		transform(path) {
			return path.node
		}
	}
}

class Identifier {
	constructor(name, type, def, typedef) {
		this.name = name,
			this.type = type,
			this.def = def,
			this.typedef = typedef
	}
}

class Scope {
	constructor() {
		this.stack = [];
		this.current = {};
	}

	get(name) {
		if (this.current[name] !== undefined) return this.current[name];
		let len = this.stack.length - 1;
		while (len >= 0) {
			if (this.stack[len][name] !== undefined) return this.stack[len][name];
			len--;
		}
		return undefined;
	}

	registe(identifier) {
		if (this.current[identifier.name] !== undefined) {
			return [false, this.current[identifier.name]];
		}
		else {
			this.current[identifier.name] = identifier;
			console.log(this)
			return [true, undefined];
		}
	}

	new_Scope() {
		this.stack.push(this.current);
		this.current = {};
	}

	exit_Scope() {
		this.current = this.stack.pop();
	}
}

export class Walker {
	constructor(ast, visitors, tokens, sourcescript) {
		this.ast = ast;
		this.tokens = tokens;
		this.sourcescript = sourcescript;
		this.visitors = visitors;
		this.scope = new Scope();
		this.error = [];
		this.warn = [];
	}

	create_Node(ast, parent = null) {
		// console.log(ast)
		return {
			parent: parent,
			node: ast,
			$scope: this.scope,
			$sourcescript: this.sourcescript,
			$tokens: this.tokens,
			$start: ast.$start,
			$end: ast.$end,
			$startidx: ast.$startidx,
			$endidx: ast.$endidx
		}
	}

	walk(ast = this.ast, parent = null) {
		// console.log(">>>>>", ast.type, this.visitors[ast.type])
		if (this.visitors[ast.type] === undefined) {
			return [ast, this.error]
		}
		let subs = this.visitors[ast.type].walk(ast, this.create_Node(ast, parent)) || [];
		if (subs !== undefined) {
			subs.forEach((key) => {
				let target = ast[key];
				if (target === undefined || target === null) return;
				if (target instanceof Array) {
					let ans = [];
					target.forEach((t) => {
						if (t === null || t === undefined) return;
						let [newast, _] = this.walk(t, ast, this.error);
						ans.push(newast);
					})
					ast[key] = ans;
				}
				else {
					let [newast, _] = this.walk(target, ast, this.error);
					ast[key] = newast;
				}
			})
		}

		let ans = this.visitors[ast.type].transform(this.create_Node(ast, parent));
		let newast;
		if (ans instanceof Array) {
			newast = ans[0];
			ans[0].$start = ast.$start;
			ans[0].$end = ast.$end;
			ans[0].$startidx = ast.$startidx;
			ans[0].$endidx = ast.$endidx;
			this.error.push(ans[1])
		}
		else {
			newast = ans;
			ans.$start = ast.$start;
			ans.$end = ast.$end;
			ans.$startidx = ast.$startidx;
			ans.$endidx = ast.$endidx;
		}
		// console.log(ans, ast, "!!!!!")
		return [newast, this.error];
	}
}

// translater
export class JSConverter {
	constructor(ast) {
		this.ast = ast;
		this.target = '';
		this.errors = [];
		this.uid = BigInt(0);
		this.scopes = [];
		this.currentscope = null;
	}

	registe_Identifier(identifier) {
		if (this.currentscope[identifier] !== undefined) return false;
		else {
			this.currentscope[identifier] = `$var${this.get_uid()}`
			return this.currentscope[identifier]
		}
	}

	new_Scope() {
		let newscope = {}
		this.scopes.push(newscope);
		this.currentscope = newscope;
	}

	exit_Scope() {
		if (this.scopes.length > 0) {
			this.currentscope = this.scopes.pop();
		}
	}

	get_uid() {
		return this.uid++;
	}

	exp(ast, last = null) {
		// console.log(ast)
		if (ast.type === 'value') {
			switch (ast.typedef.value) {
				case 'string': return `"${ast.value}"`;
				case 'real': return `${ast.value}`;
				case 'int': return `BigInt("${ast.value}")`;
				default: return `${ast.value}`;
			}
		}
		else if (ast.type === 'funccall') {
			const MAP = {
				print: (args, raw) => { `console.log(${args})` },
				range: (args, raw) => {
					let uid = this.get_uid()
					return `(()=>{let arr${uid} = [];for (let i = 1; i <= ${args}; i++) {arr${uid}.push(i)};return arr${uid}})()`
				}
			}
			let args = ast.arguments.map(i => this.exp(i)).join(", ")
			let func = this.exp(ast.identifier)
			return MAP[func] !== undefined ? MAP[func](args, ast.arguments) : `${func}(${args})`
		}
		else if (ast.type === 'identifier') {
			return ast.value
		}
		else if (ast.type === 'binop') {
			return `(${this.exp(ast.sub[0], ast.value)}${ast.value}${this.exp(ast.sub[1], ast.value)})`
			// return `${ast.value !== last && last !== null ? '(' : ''}${this.exp(ast.sub[0], ast.value)}${ast.value}${this.exp(ast.sub[1], ast.value)}${ast.value !== last && last !== null ? ')' : ''}`
		}
		else if (ast.type === 'uniop') {
			return `${ast.value !== last && last !== null ? '(' : ''}${ast.value}${this.exp(ast.sub[0], ast.value)}${ast.value !== last && last !== null ? ')' : ''}`
		}
		else if (ast.type === 'array') {
			let items = ast.expressions.map(i => this.exp(i)).join(', ')
			return `[${items}]`
		}
		else if (ast.type === 'indexof') {
			return `${ast.identifier}[${this.exp(ast.index)}]`
		}
	}

	funcdef(ast, func = true) {
		let identifier = ast.identifier
		let ans = this.registe_Identifier(identifier)
		if (!ans) {
			this.errors.push({ message: `标识符 "${identifier}" 重定义`, start: ast.$start, end: ast.$end })
		}
		let body = this.subprogram(ast.block).split('\n').tab()
		return `function ${identifier.identifier}() {\n${body}\n}`
	}

	call(ast) {
		// console.log(ast)
		return `${ast.identifier.value}();`
	}

	assign(ast) {
		return `${ast.identifier.value} = ${this.exp(ast.expression)};`
	}

	identifier(ast) {
		return ast.value
	}

	write(ast) {
		let arr = ast.expressions.map(s => this.get(s))
		arr = arr.map(a => "${" + a + "}").join(" ")
		return `$writebuffer += \`${arr}\\n\`;`
	}

	value(ast) {
		switch (ast.datatype) {
			case 'string': return `"${ast.value}"`;
			default: return `BigInt("${ast.value}")`;
		}
	}

	indexof(ast) {
		return `${ast.identifier}[${this.exp(ast.index)}]`
	}

	read(ast) {
		let arr = []
		let identifier = ast.identifiers
		identifier.forEach((i) => {
			arr.push(`${i} = BigInt(prompt("请输入：${i}"))`)
		})
		return `${arr.join('\n')}`
	}

	block(ast) {
		let arr = ast.statments.map(s => this.get(s)).tab()
		return `{\n${arr}\n}`
	}

	binop(ast, last = null) {
		return `(${this.exp(ast.sub[0], ast.value)}${ast.value}${this.exp(ast.sub[1], ast.value)})`
	}

	uniop(ast, last = null) {
		return `(${ast.value}${this.exp(ast.sub[0], ast.value)})}`
	}

	if(ast) {
		let ifbody = ast.sub.filter((i) => i !== null).map(s => this.get(s)).tab()
		let elsebody = ast.else.filter((i) => i !== null).map(s => this.get(s)).tab()
		return `if (${this.exp(ast.expression)}) {\n${ifbody}\n}\nelse {\n${elsebody}\n}`
	}

	while(ast) {
		let ifbody = ast.sub.filter((i) => i !== null).map(s => this.get(s)).tab()
		return `while (${this.exp(ast.expression)}) {\n${ifbody}\n}`
	}

	subprogram(ast) {
		let that = this;
		let consts = ast.consts;
		let arr = []
		let constdefs = consts.forEach((s) => {
			s.consts.forEach((c) => {
				let ans = that.registe_Identifier(c.identifier)
				if (!ans) {
					that.errors.push({ message: `标识符 "${c.identifier}" 重定义`, start: c.$start, end: c.$end })
				}
				arr.push(`const ${c.identifier} = ${this.exp(c.value)};`)
			})
		})
		let vars = ast.vars;
		let vardefs = vars.forEach((s) => {
			s.vars.forEach((c) => {
				let ans = that.registe_Identifier(c.identifier)
				if (!ans) {
					that.errors.push({ message: `标识符 "${c.identifier}" 重定义`, start: c.$start, end: c.$end })
				}
				arr.push(`let ${c.identifier}${c.default !== null ? ' = ' + this.exp(c.default) : ''};`)
			})
		})
		let procs = ast.procs;
		let procdefs = procs.forEach((s) => {
			arr.push(this.funcdef(s))
		})
		if (ast.subs !== null) {
			let subs = ast.subs;
			arr.push(this.get(subs))
		}
		this.exit_Scope()
		return `${arr.join('\n')}`;
	}

	get(s) {
		return this[s.type] ? this[s.type](s) : 'unknown node'
	}

	convert() {
		this.target = "let $writebuffer = '';\n" + this[this.ast.type](this.ast) + "\n($writebuffer);";
		return this.target;
	}
}

export class SSIRConverter {
	constructor(ast) {
		this.ast = ast;
		this.target = '';
		this.errors = [];
		this.uid = BigInt(0);
		this.ir = [];
	}

	get_uid() {
		return this.uid++;
	}

	exp(ast, last = null) {
		// console.log(ast)
		if (ast.type === 'value') {
			let tmp = `$x_${this.get_uid()}`;
			this.ir.push(`mov\t${tmp}\t${ast.value}`);
			return tmp;
		}
		else if (ast.type === 'funccall') {
			const MAP = {
				print: (args, raw) => { `console.log(${args})` },
				range: (args, raw) => {
					let uid = this.get_uid()
					return `(()=>{let arr${uid} = [];for (let i = 1; i <= ${args}; i++) {arr${uid}.push(i)};return arr${uid}})()`
				}
			}
			let args = ast.arguments.map(i => this.exp(i)).join(", ")
			let func = this.exp(ast.identifier)
			return MAP[func] !== undefined ? MAP[func](args, ast.arguments) : `${func}(${args})`
		}
		else if (ast.type === 'identifier') {
			return ast.value
		}
		else if (ast.type === 'binop') {
			let tmp = `$x_${this.get_uid()}`;
			this.ir.push(`${ast.value}\t${tmp}\t${this.exp(ast.sub[0], ast.value)}\t${this.exp(ast.sub[1], ast.value)}`);
			return tmp;
		}
		else if (ast.type === 'uniop') {
			return `${ast.value !== last && last !== null ? '(' : ''}${ast.value}${this.exp(ast.sub[0], ast.value)}${ast.value !== last && last !== null ? ')' : ''}`
		}
		else if (ast.type === 'array') {
			let items = ast.expressions.map(i => this.exp(i)).join(', ')
			return `[${items}]`
		}
		else if (ast.type === 'indexof') {
			return `${ast.identifier}[${this.exp(ast.index)}]`
		}
	}

	funcdef(ast, func = true) {
		let identifier = ast.identifier
		let body = this.subprogram(ast.block).split('\n').tab()
		return `function ${identifier.identifier}() {\n${body}\n}`
	}

	call(ast) {
		// console.log(ast)
		return `${ast.identifier.value}();`
	}

	assign(ast) {
		this.ir.push(`mov\t${ast.identifier.value}\t${this.exp(ast.expression)};`)
	}

	identifier(ast) {
		return ast.value
	}

	write(ast) {
		let arr = ast.expressions.map(s => this.get(s))
		arr = arr.map(a => "${" + a + "}").join(" ")
		return `$writebuffer += \`${arr}\\n\`;`
	}

	value(ast) {
		switch (ast.datatype) {
			case 'string': return `"${ast.value}"`;
			default: return `BigInt("${ast.value}")`;
		}
	}

	indexof(ast) {
		return `${ast.identifier}[${this.exp(ast.index)}]`
	}

	read(ast) {
		let arr = []
		let identifier = ast.identifiers
		identifier.forEach((i) => {
			arr.push(`${i} = BigInt(prompt("请输入：${i}"))`)
		})
		return `${arr.join('\n')}`
	}

	block(ast) {
		let arr = ast.statments.map(s => this.get(s)).tab()
		return `{\n${arr}\n}`
	}

	binop(ast, last = null) {
		return `(${this.exp(ast.sub[0], ast.value)}${ast.value}${this.exp(ast.sub[1], ast.value)})`
	}

	uniop(ast, last = null) {
		return `(${ast.value}${this.exp(ast.sub[0], ast.value)})}`
	}

	if(ast) {
		let tag = `IF_${this.get_uid()}`;
		let flag = this.exp(ast.expression);
		// let ifbody = ast.sub.filter((i) => i !== null).map(s => this.get(s)).tab()
		// let elsebody = ast.else.filter((i) => i !== null).map(s => this.get(s)).tab()
		this.ir.push(`jz\t${flag}\t${tag}_ELSE`)
		ast.sub.filter((i) => i !== null).map(s => this.get(s))
		this.ir.push(`jmp\t${tag}_END`)
		this.ir.push(`${tag}_ELSE:`)
		ast.else.filter((i) => i !== null).map(s => this.get(s))
		this.ir.push(`${tag}_END:`)
	}

	while(ast) {
		let ifbody = ast.sub.filter((i) => i !== null).map(s => this.get(s)).tab()
		return `while (${this.exp(ast.expression)}) {\n${ifbody}\n}`
	}

	subprogram(ast) {
		let ir = this.ir;
		let that = this;
		let consts = ast.consts;
		let arr = []
		let constdefs = consts.forEach((s) => {
			s.consts.forEach((c) => {
				arr.push(`const ${c.identifier} = ${this.exp(c.value)};`)
			})
		})
		let vars = ast.vars;
		let vardefs = vars.forEach((s) => {
			s.vars.forEach((c) => {
				console.log(">>>>>")
				ir.push(`alc\t${c.identifier}`)
				if (c.default !== null)
					ir.push(`mov\ta\t${this.exp(c.default)}`)
			})
		})
		let procs = ast.procs;
		let procdefs = procs.forEach((s) => {
			arr.push(this.funcdef(s))
		})
		if (ast.subs !== null) {
			let subs = ast.subs;
			arr.push(this.get(subs))
		}
		return `${arr.join('\n')}`;
	}

	get(s) {
		return this[s.type] ? this[s.type](s) : 'unknown node'
	}

	convert() {
		this[this.ast.type](this.ast);
		this.target = this.ir.join("\n");
		return this.target;
	}
}

// VM
export class SSIR {
	constructor() {

	}
}

export class SSVM {
	constructor() {
		this.memory = [];

	}
}