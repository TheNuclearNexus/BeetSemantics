    
from dataclasses import dataclass, field
from importlib.abc import SourceLoader
import json
from sre_compile import isstring
from typing import Dict, List, overload
from mecha import *
from mecha.contrib.bolt import *
from beet.core.utils import snake_case
from tokenstream import SourceLocation

simple_types = (
    AstAdvancementPredicate,
    AstAssignment,
    # AstAttribute,
    AstBlock,
    AstBlockMarkerParticleParameters,
    AstBlockParticleParameters,
    AstBlockState,
    AstBool,
    AstChildren,
    AstColor,
    AstColorReset,
    # AstCommand,
    AstCoordinate,
    AstDict,
    AstDictItem,
    AstDustColorTransitionParticleParameters,
    AstDustParticleParameters,
    AstEntityAnchor,
    AstExpression,
    AstExpressionBinary,
    AstExpressionUnary,
    AstFallingDustParticleParameters,
    # AstFormatString,
    AstFunctionRoot,
    AstFunctionSignature,
    AstFunctionSignatureArgument,
    AstGamemode,
    AstGreedy,
    # AstIdentifier,
    # AstImportedIdentifier,
    # AstInterpolation,
    AstItem,
    AstItemParticleParameters,
    AstItemSlot,
    AstJson,
    AstJsonArray,
    AstJsonObject,
    AstJsonObjectEntry,
    AstJsonObjectKey,
    AstJsonValue,
    AstKeyword,
    AstList,
    AstLiteral,
    AstLookup,
    # AstMessage,
    AstMessageText,
    AstNbt,
    AstNbtByteArray,
    AstNbtCompound,
    AstNbtCompoundEntry,
    AstNbtCompoundKey,
    AstNbtIntArray,
    AstNbtList,
    AstNbtLongArray,
    AstNbtPath,
    AstNbtPathKey,
    AstNbtPathSubscript,
    AstNbtValue,
    AstNumber,
    AstObjective,
    AstObjectiveCriteria,
    AstOption,
    AstParticle,
    AstParticleParameters,
    AstPlayerName,
    AstRange,
    AstResourceLocation,
    AstScoreboardOperation,
    AstScoreboardSlot,
    AstSelector,
    AstSelectorAdvancementMatch,
    AstSelectorAdvancementPredicateMatch,
    AstSelectorArgument,
    AstSelectorScoreMatch,
    AstSelectorScores,
    AstSlice,
    AstSortOrder,
    AstString,
    AstSwizzle,
    AstTarget,
    # AstTargetAttribute,
    # AstTargetIdentifier,
    AstTargetItem,
    AstTeam,
    AstTime,
    AstTuple,
    AstUnpack,
    AstUUID,
    # AstValue,
    AstVector2,
    AstVector3,
    AstVibrationParticleParameters,
    AstWildcard,
    AstWord,
    
)

@dataclass
class TokenHighlighter(Reducer):
    tokens: List[Dict] = field(default_factory=list)
    
    
    def addToken(self, type: str, start: SourceLocation, end: SourceLocation, value = None):

            
        self.tokens.append(
            {
                "type": type,
                "start": start,
                "end": end,
                "value": value
            }
        )

    def addTokenFromNode(self, type: str, node: AstNode, value = None):
        if(value == None):
            try:
                if(isstring(node.value)):
                    value = node.value
                else:
                    value = json.dumps(node.value)
            except:
                pass
        self.addToken(type, node.location, node.end_location, value)
        

    # @rule(match_types=simple_types)
    # def simpleTypes(self, node: AstNode):
    #     self.addToken(snake_case(node.__class__.__name__[3:]), node)
        
    @rule(AstCall)
    def call(self, node: AstCall):
        if(isinstance(node, AstAttribute)):
            self.addTokenFromNode("method_call", node, node.name)
        elif(isinstance(node, AstIdentifier)):
            self.addTokenFromNode("function_call", node, node.value)
    
    @rule(AstCommand)
    def command(self, node: AstCommand):
        self.addTokenFromNode("command", node, node.identifier)
    
    @rule(AstValue)
    def value(self, node: AstValue):
        self.addTokenFromNode(snake_case(type(node.value).__name__), node, node.value)
        
    @rule(*(AstAttribute, AstTargetAttribute))
    def interpolation(self, node: AstAttribute | AstTargetAttribute):
        if(isinstance(node.value, AstValue)):
            self.addTokenFromNode(snake_case(node.__class__.__name__[3:]), node, node.value.value)
        else:
            self.addTokenFromNode(snake_case(node.__class__.__name__[3:]), node)
        
    @rule(*(AstIdentifier, AstTargetIdentifier, AstImportedIdentifier))
    def indentifier(self, node: AstIdentifier | AstTargetIdentifier | AstImportedIdentifier):
        self.addTokenFromNode('identifier', node, node.value)
        
    @rule(AstInterpolation)
    def interpolation(self, node: AstInterpolation):    
        self.addTokenFromNode(snake_case(node.__class__.__name__[3:]), node, node.value.__class__.__name__)
    
    @rule(AstFormatString)
    def format_string(self, node: AstFormatString):
        if(node.fmt != None):
            self.addToken('format_string', node.location, SourceLocation(node.location.pos + 1, node.location.lineno, node.location.colno + 1), node.fmt)
            self.addToken('string', SourceLocation(node.location.pos + 1, node.location.lineno, node.location.colno + 1), node.end_location, node.fmt)

    @rule(*simple_types)
    def simpleNodes(self, node: AstNode):
        self.addTokenFromNode(snake_case(node.__class__.__name__[3:]), node)
        
        
        
        
        
        
        
        
