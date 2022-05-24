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



def setupTokens(ctx: Context, function: str):    
    mc = ctx.inject(Mecha)
    # mc.spec.parsers["root"] = TokenExtractor(mc.spec.parsers["root"], ctx)
    # mc.spec.parsers["nested_root"] = TokenExtractor(mc.spec.parsers["nested_root"], ctx)
    
  
    mc.database.current = Function(function)
        
    mc.database[mc.database.current] = CompilationUnit(resource_location="dummy:foo")
    # mc.parse(mc.database.current)
    highlighter = TokenHighlighter()
    highlighter(mc.parse(mc.database.current))
    
    ctx.meta["tokens"] = highlighter.tokens
    
def sortByTokenLength(t):
    return t['end'][0] - t['start'][0]
    
def grabTokens(function: str, config: str):
    # if(sys.argv[2] != None):
    #     if(sys.argv[2].endswith('json')):
    #         config = json.load(open(sys.argv[2]))
    #     elif(sys.argv[2].endswith('yaml')):
    #         config = yaml.load(open(sys.argv[2]), Loader=yaml.FullLoader)
    
    # os.chdir(os.path.dirname(sys.argv[2]))
    
    if(config == ''):
        config = {"require": ["bolt"]}
    
    try:
        with run_beet(config) as ctx:
            setupTokens(ctx, function)
            tokens: List[Dict] = ctx.meta["tokens"] 
            # tokens.sort(key=sortByTokenLength, reverse=True)
            return {'status': 'ok', 'tokens': tokens}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

for line in sys.stdin:
    request = json.loads(line)
    
    if request["mode"] == 'tokens':
        function = request["text"]
        config = request["config"] if 'config' in request else ''
        # sys.stdin.flush()
        print(json.dumps(grabTokens(function, config)))
        # print(function, config)
    # print(line)
    sys.stdout.flush()