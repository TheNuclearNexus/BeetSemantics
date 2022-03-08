import { spawn } from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs'
import { PythonShell } from 'python-shell';
import * as path from 'path'
import fetch from 'node-fetch';
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

export function activate(context: vscode.ExtensionContext) {
	context.asAbsolutePath
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'mcfunction' }, new DocumentSemanticTokensProvider(context), legend));
}

interface IParsedToken {
	range: number[];
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

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	asAbsolutePath
	constructor(context: vscode.ExtensionContext) {
		this.asAbsolutePath = context.asAbsolutePath
	}
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const allTokens = await this._parseText(document.getText(), document.uri);

		const builder = new vscode.SemanticTokensBuilder(legend);
		allTokens.forEach((tokens, line) => {
			tokens.forEach((token) => {
				builder.push(new vscode.Range(
					new vscode.Position(line, token.range[0] - 1),
					new vscode.Position(line, token.range[1] - 1)
				), token.tokenType, token.tokenModifiers);
			})
		});

		return builder.build();
	}

	private _encodeTokenModifiers(tokenType: string): string[] {
		switch(tokenType) {
			case 'objective':
				return ['readonly']
		}
		return []
	}

	private _encodeTokenType(tokenType: string): string | undefined {
		// if (tokenTypes.has(tokenType)) {
		// 	return tokenType;
		// } else if (tokenType === 'notInLegend') {
		// 	return tokenTypes.size + 2;
		// }

		switch (tokenType) {
			case 'literal':
			case 'command':
			case 'keyword':
				return 'keyword'
			case 'resource_location':
			case 'resource':
			case 'function_signature':
			case 'call':
			case 'block':
			case 'item':
			case 'target_item':
				return 'function'
			case 'text':
			case 'string':
			case 'json_value':
			case 'json_object_key':
			case 'message_text':
			case 'str':
			case 'interpolation':
			case 'nbt_value':
			case 'value':
				return 'string'
			case 'word':
			case 'key':
			case 'entity_anchor':
			case 'function_signature_argument':
				return 'property'
			case 'selector':
			case 'player_name':
				return 'class'
			case 'exclamation':
			case 'equal':
			case 'operator':
			case 'expression_binary':
			case 'expression_unary':
				return 'operator'
			case 'objective':
			case 'target_identifier':
			case 'target_attribute':
			case 'identifier':
			case 'attribute':
			case 'selector_argument':
			case 'nbt_compound_key':
				return 'variable'
			case 'number':
			case 'range':
			case 'int':
			case 'coordinate':
			case 'scoreboard_slot':
			case 'item_slot':
			case 'vector3':
				return 'number'
			case 'colon':
				return 'label'
			case 'false':
			case 'true':
			case 'bool':
			case 'format_string':
			case 'json_array':
			case 'json_object':
			case 'assignment':
			case 'json_object_entry':
			case 'list':
			case 'nbt_compound':
			case 'lookup':
				return 'macro'

			// default:
			// 	return 'keyword'
		}
		return undefined;
	}


	private async _parseText(text: string, uri: vscode.Uri): Promise<IParsedToken[][]> {
		if (!extension) return []

		let json = await this.getTokensJson(text)
		if (json === 'error') {
			if (prevTokens[0] === uri.toString()) {
				return prevTokens[1]
			} else {
				return []
			}
		}
		json = json.substring(0, json.length / 2)
		// fs.writeFileSync(path.join(extension.extensionPath, 'out.json'), JSON.stringify(JSON.parse(json), null, 2))
		let tempTokens: Token[] = JSON.parse(json)
		tempTokens = tempTokens.sort(t => t.end[0] - t.start[0]).reverse()
		let vsTokens: IParsedToken[][] = new Array(text.includes('\n') ? text.split('\n').length + 1 : 1)

		let unknownToken: string[] = []
		for (let t of tempTokens) {
			// console.log(t)
			if (t.type === 'whitespace' || t.type === 'newline' || t.type === 'indent' || t.type === 'escape') continue;
			let type = this._encodeTokenType(t.type)
			if (type === undefined) {
				type = 'regexp'
				if (!unknownToken.includes(t.type)) unknownToken.push(t.type)
				continue;
			}

			const lines = text.split('\n').slice(t.start[1] - 1, t.end[1])

			for (let lineNum = 0; lineNum < lines.length; lineNum++) {
				if (lines[lineNum] === '' || lines[lineNum].replaceAll(/[\s]/g, '').startsWith('#')) {
					console.log('no token')
					continue;
				}
				const idx = t.start[1] + lineNum - 1
				const token = {
					tokenType: type,
					range: [
						(lineNum === 0 ? t.start[2] : 1),
						lines.length === 1 ?
							t.end[2] :
							lines[lineNum].length + (lineNum === lines.length - 1 ? 1 : 0)],
					tokenModifiers: this._encodeTokenModifiers(t.type)
				}
				if (vsTokens[idx] === undefined) vsTokens[idx] = [token]
				else {
					this.cullOverlap(vsTokens, idx, token);
				}
			}
		}

		console.log(vsTokens[0])
		prevTokens = [uri.toString(), vsTokens]
		console.log(unknownToken.sort())
		// console.log(`Result: ${result}`)
		return vsTokens
	}


	private getTokensJson(text: string) {
		return new Promise<string>((resolve, reject) => {
			PythonShell.run(this.asAbsolutePath('server/main.py'), { args: [text] }, (err, output) => {
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
						tokenModifiers: target.tokenModifiers
					});

				if (target.range[1] != token.range[1])
					tempTokens.push({
						tokenType: target.tokenType,
						range: [token.range[1], target.range[1]],
						tokenModifiers: target.tokenModifiers
					});
			} else {
				tempTokens.push(target);
			}
		});
		vsTokens[idx] = tempTokens;
		vsTokens[idx].push(token);
	}
}