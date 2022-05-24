from dataclasses import dataclass
import json
from lib2to3.pgen2 import token
import os
import sys
from typing import Any, Dict, List
from mecha import CompilationUnit, Parser, Mecha
from beet import Context, Function, run_beet
from tokenstream import TokenStream
import yaml

from TokenHighlighter import TokenHighlighter

@dataclass
class TokenExtractor:
    parser: Parser
    ctx: Context

    def __call__(self, stream: TokenStream) -> Any:
        node = self.parser(stream)
        tokens = []
        for t in stream.tokens:
            tokens.append({'type': t.type, 'value': t.value, 'start': t.location, 'end': t.end_location})
        
        self.ctx.meta.setdefault("tokens", []).extend(tokens)
        
        return node



def setupTokens(ctx: Context):    
    mc = ctx.inject(Mecha)
    # mc.spec.parsers["root"] = TokenExtractor(mc.spec.parsers["root"], ctx)
    # mc.spec.parsers["nested_root"] = TokenExtractor(mc.spec.parsers["nested_root"], ctx)
    
  
    mc.database.current = Function(sys.argv[1])
        
    mc.database[mc.database.current] = CompilationUnit(resource_location="dummy:foo")
    # mc.parse(mc.database.current)
    highlighter = TokenHighlighter()
    highlighter(mc.parse(mc.database.current))
    
    ctx.meta["tokens"] = highlighter.tokens
    
def sortByTokenLength(t):
    return t['end'][0] - t['start'][0]
    
def grabTokens():
    # if(sys.argv[2] != None):
    #     if(sys.argv[2].endswith('json')):
    #         config = json.load(open(sys.argv[2]))
    #     elif(sys.argv[2].endswith('yaml')):
    #         config = yaml.load(open(sys.argv[2]), Loader=yaml.FullLoader)
    
    # os.chdir(os.path.dirname(sys.argv[2]))
    
    config = {"require": ["bolt"]}
    if(len(sys.argv) > 2):
        config = sys.argv[2]
    
    with run_beet(config) as ctx:
        setupTokens(ctx)
        tokens: List[Dict] = ctx.meta["tokens"] 
        # tokens.sort(key=sortByTokenLength, reverse=True)
        return json.dumps(tokens, indent=2)    
    
print(grabTokens())
# grabTokens()