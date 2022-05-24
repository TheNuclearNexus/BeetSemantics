import { spawn } from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs'
import { PythonShell } from 'python-shell';
import * as path from 'path'
import fetch from 'node-fetch';
import { encodeTokenType } from './encoder';
const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const extension = vscode.extensions.getExtension('mcbeet.highlighter')
if (extension === undefined) {
	throw new Error('Extension not found!')
}

const legend = (function () {
	const tokenTypesLegend = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

let shell: PythonShell

function requestFromPython(command: string): Promise<string> {
	return new Promise((resolve, reject) => {
		if (shell.terminated) reject('error')
		shell.on('message', (message: string) => {
			resolve(message);
		});
		shell.send(command);
		// setTimeout(() => { reject('error') }, 200)
	});
}

export function activate(context: vscode.ExtensionContext) {
	const python = vscode.workspace.getConfiguration("python")
	let path: string | undefined = python.get("pythonPath")

	if (path === undefined || !fs.existsSync(path))
		path = python.get("defaultInterpreterPath")

	shell = new PythonShell(context.asAbsolutePath('server/main.py'), { pythonPath: path })
	shell.on('error', (err) => { console.log(err) })
	shell.on('pythonError', (err) => { console.log(err) })
	shell.on('message', (msg) => console.log('From init on msg: ', msg.substring(0, 100)))
	// context.asAbsolutePath
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'mcfunction' }, new DocumentSemanticTokensProvider(context), legend));
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'bolt' }, new DocumentSemanticTokensProvider(context), legend));
}

export function deactivate() {
	if (shell) {
		shell.end(() => {
			console.log('Python shell ended')
		})
	}
}

interface IParsedToken {
	range: number[];
	originalType: string;
	tokenType: string;
	tokenModifiers: string[];
}

interface Token {
	type: string,
	value: string,
	start: number[]
	end: number[]
}

let prevTokens: [string, IParsedToken[][]] = ['', []]
let prevDocument: string
let beetConfig: string | undefined
class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	asAbsolutePath
	constructor(context: vscode.ExtensionContext) {
		this.asAbsolutePath = context.asAbsolutePath
	}
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		if (document.uri.toString() !== prevDocument && document.uri.scheme === 'file') {
			prevDocument = document.uri.fsPath
			beetConfig = path.dirname(prevDocument)
			let iters = 0;
			while (!(fs.existsSync(beetConfig + 'beet.json') || fs.existsSync(beetConfig + 'beet.yaml')) && iters < 20) {
				let newConfig = path.join(beetConfig, '../')
				if (newConfig === beetConfig) break;
				beetConfig = newConfig
				iters++
			}

			if (fs.existsSync(beetConfig + 'beet.json')) beetConfig = beetConfig + 'beet.json'
			else if (fs.existsSync(beetConfig + 'beet.yaml')) beetConfig = beetConfig + 'beet.yaml'
			else {
				// vscode.window.showErrorMessage('Could not find beet.json or beet.yaml!')
				beetConfig = undefined;
			}
		}
		const allTokens = await this._parseText(document.getText(), document.uri);

		const builder = new vscode.SemanticTokensBuilder(legend);
		allTokens.forEach((tokens, line) => {
			tokens.forEach((token) => {
				if (token.tokenType !== 'none') {
					builder.push(new vscode.Range(
						new vscode.Position(line, token.range[0] - 1),
						new vscode.Position(line, token.range[1] - 1)
					), token.tokenType, token.tokenModifiers);
				}
			})
		});

		return builder.build();
	}

	private _encodeTokenModifiers(tokenType: string): string[] {
		switch (tokenType) {
			case 'entity_anchor':
			case 'objective':
			case 'team':
			case 'wildcard':
				return ['readonly']
		}
		return []
	}


	private _regexIndoxOf(text: string, regex: RegExp, pos?: number) {
		if (!pos) pos = 0
		for (let c = pos; c < text.length; c++) {
			// console.log(text.substring(pos, c))
			if (text.charAt(c).match(regex)) return c
		}
		return -1
	}

	private _splitCommands(t: Token, i: number, a: Token[], text: string) {
		if (t.type === 'command') {
			if (t.value === 'statement') return
			const end = [...t.start]
			const pos = t.start[0]
			const start = text.substring(pos, this._regexIndoxOf(text, /[\s\n]+/g, pos))
			// console.log(start)
			if (start != '') {
				end[0] += start.length
				end[2] += start.length

				a.push({
					type: 'command_start',
					start: t.start,
					end: end,
					value: start
				})
				// console.log(a[a.length - 1])
			}
		}
	}

	private async _parseText(text: string, uri: vscode.Uri): Promise<IParsedToken[][]> {
		if (!extension) return []

		console.log('Parsing ' + uri.toString())
		let rawJson = await requestFromPython(JSON.stringify({ mode: 'tokens', text: text, config: beetConfig }))
		console.log(rawJson)
		let json = JSON.parse(rawJson)
		
		if (json.status === 'error') {
			vscode.window.showErrorMessage(json.message.split('\n\n')[1]);
			return prevTokens[1]
		}

		// fs.writeFileSync(this.asAbsolutePath('input.json'), JSON.stringify(JSON.parse(json), null, 2))
		let tempTokens: Token[] = json.tokens
		console.log(tempTokens.length)
		tempTokens = tempTokens.sort(t => t.end[0] - t.start[0]).reverse()
		console.log('sorted')
		tempTokens.forEach((t, i, a) => this._splitCommands(t, i, a, text))
		console.log('split')

		let vsTokens: IParsedToken[][] = new Array(text.includes('\n') ? text.split('\n').length + 1 : 1)

		let unknownToken: string[] = []
		for (let t of tempTokens) {
			// console.log(t)
			if (t.type === 'whitespace' || t.type === 'newline' || t.type === 'indent' || t.type === 'escape') continue;
			let type = encodeTokenType(t.type)
			if (type === undefined) {
				if (!unknownToken.includes(t.type)) unknownToken.push(t.type)
				console.log(t.type, t.value)
				type = 'none'
			}

			const lines = text.split('\n').slice(t.start[1] - 1, t.end[1])

			for (let lineNum = 0; lineNum < lines.length; lineNum++) {
				if (lines[lineNum] === '' || lines[lineNum].replaceAll(/[\s]/g, '').startsWith('#')) {
					console.log('no token', t)
					continue;
				}
				const idx = t.start[1] + lineNum - 1
				const token = {
					tokenType: type,
					range: [
						(lineNum === 0 ? t.start[2] : 1),
						lines.length - 1 === lineNum || lines.length === 1 ?
							t.end[2] :
							lines[lineNum].lastIndexOf('#') !== -1 ? lines[lineNum].lastIndexOf('#') : lines[lineNum].length],
					tokenModifiers: this._encodeTokenModifiers(t.type),
					originalType: t.type
				}
				if (vsTokens[idx] === undefined) vsTokens[idx] = [token]
				else {
					this.cullOverlap(vsTokens, idx, token);
				}
			}
		}

		prevTokens = [uri.toString(), vsTokens]
		console.log(unknownToken.sort())
		// fs.writeFileSync(this.asAbsolutePath('out.json'), JSON.stringify(vsTokens, null, 2))
		// console.log(`Result: ${result}`)
		return vsTokens
	}


	private getTokensJson(text: string) {
		return new Promise<string>((resolve, reject) => {
			const python = vscode.workspace.getConfiguration("python")
			let path: string | undefined = python.get("pythonPath")

			if (path === undefined || !fs.existsSync(path))
				path = python.get("defaultInterpreterPath")

			const shell = PythonShell.run(this.asAbsolutePath('server/main.py'), { args: beetConfig !== undefined ? [text, beetConfig] : [text], pythonPath: path }, (err, output) => {
				if (err != undefined) {
					const traceback = err.traceback.toString();

					const exp = RegExp(/line ([0-9]+), column ([0-9]+): /g);

					const result = exp.exec(traceback);
					if (result == null) {
						resolve('error');
						console.log(err);
						return;
					}

					const actualError = traceback.substring(exp.lastIndex - result[0].length, traceback.indexOf('The above exception was the', exp.lastIndex));
					console.log(actualError);
					vscode.window.showErrorMessage(actualError);
					resolve('error');
					return;
				}
				if (output === undefined) {
					resolve('');
					return;
				}
				const json = output.join('');
				resolve(json);

			});
			shell.send(text);
			shell.once('message', (msg) => {

			})
		});

	}

	private cullOverlap(vsTokens: IParsedToken[][], idx: number, token: IParsedToken) {
		let tempTokens: IParsedToken[] = [];
		vsTokens[idx].forEach((target, targetIdx, arr) => {
			const isLower = target.range[0] <= token.range[0];
			const isUpper = token.range[1] <= target.range[1];

			if (isLower && isUpper) {
				if (target.range[0] != token.range[0])
					tempTokens.push({
						tokenType: target.tokenType,
						range: [target.range[0], token.range[0]],
						tokenModifiers: target.tokenModifiers,
						originalType: target.originalType
					});

				if (target.range[1] != token.range[1])
					tempTokens.push({
						tokenType: target.tokenType,
						range: [token.range[1], target.range[1]],
						tokenModifiers: target.tokenModifiers,
						originalType: target.originalType
					});
			} else {
				tempTokens.push(target);
			}
		});
		vsTokens[idx] = tempTokens;
		vsTokens[idx].push(token);
	}
}