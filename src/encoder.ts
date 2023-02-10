export function encodeTokenType(tokenType: string): string | undefined {
	// if (tokenTypes.has(tokenType)) {
	// 	return tokenType;
	// } else if (tokenType === 'notInLegend') {
	// 	return tokenTypes.size + 2;
	// }

	switch (tokenType) {
		case 'literal':
		case 'command_start':
		case 'keyword':
			return 'keyword'
		case 'resource_location':
		case 'resource':
		case 'function_signature':
		case 'call_identifier':
		case 'block':
		case 'item':
		case 'target_item':
		case 'call':
			return 'function'
		case 'text':
		case 'string':
		case 'json_value':
		case 'json_object_key':
		case 'message_text':
		case 'str':
		case 'nbt_value':
			// case 'value':
			return 'string'
		case 'word':
		case 'key':
		case 'entity_anchor':
			return 'property'
		case 'selector':
		case 'player_name':
		case 'class_name':
		case 'decorator':
			return 'class'
		case 'exclamation':
		// case 'equal':
		// case 'operator':
			return 'operator'
		case 'function_signature_argument':
		case 'objective':
		case 'objective_criteria':
		case 'team':
		case 'wildcard':
		case 'target_identifier':
		case 'target_attribute':
		case 'imported_identifier':
		case 'identifier':
		case 'attribute':
		case 'nbt_compound_key':
		case 'advancement_predicate':
			return 'variable'
		case 'number':
		case 'uuid':
		case 'range':
		case 'int':
		case 'coordinate':
		case 'scoreboard_slot':
		case 'item_slot':
		case 'vector3':
		case 'time':
		case 'nbt_path_subscript':
		case 'byte':
		case 'short':
		case 'long':
		case 'float':
		case 'double':
			return 'number'
		case 'colon':
			return 'label'
		case 'false':
		case 'true':
		case 'bool':
		case 'format_string':
		case 'interpolation':
		case 'command':
		case 'none_type':
			return 'macro'
		case 'unpack':
		case 'nbt_compound':
		case 'slice':
		case 'json_array':
		case 'json_object':
		case 'json_object_entry':
		case 'list':
		case 'lookup':
		case 'assignment':
		case 'tuple':
		case 'expression_binary':
		case 'expression_unary':
		case 'nbt_compound_entry':
		case 'nbt_list':
		case 'selector_argument':
		case 'dict':
		case 'dict_item':
		case 'nbt_path':
		case 'scoreboard_operation':
		case 'nbt_path_key':
			return 'none'

		// default:
		// 	return 'keyword'
	}
	return undefined;
}