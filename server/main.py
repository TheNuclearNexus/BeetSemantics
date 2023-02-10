import json
import os
import sys
from dataclasses import dataclass
from lib2to3.pgen2 import token
from types import TracebackType
from typing import Any, Dict, List

import yaml
from beet import Context, Function, run_beet
from mecha import (CompilationError, CompilationUnit, DiagnosticError,
                   DiagnosticErrorSummary, Mecha, Parser)
from TokenHighlighter import TokenHighlighter
from tokenstream import TokenStream


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
    
def grabTokens(function: str, configPath: str):
    # if(sys.argv[2] != None):
    #     if(sys.argv[2].endswith('json')):
    #         config = json.load(open(sys.argv[2]))
    #     elif(sys.argv[2].endswith('yaml')):
    #         config = yaml.load(open(sys.argv[2]), Loader=yaml.FullLoader)
    
    # os.chdir(os.path.dirname(sys.argv[2]))
    
    config = {}
    
    if(configPath != ''):
        text = open(configPath, 'r').read()
        config = json.loads(text) if configPath.endswith('json') else yaml.load(text, Loader=yaml.FullLoader)
        if('output' in config):
            config['output'] = None
        os.chdir(os.path.dirname(configPath))
    try:
        with run_beet(config) as ctx:
            setupTokens(ctx, function)
            tokens: List[Dict] = ctx.meta["tokens"] 
            # tokens.sort(key=sortByTokenLength, reverse=True)
            return {'status': 'ok', 'tokens': tokens}
    except DiagnosticErrorSummary as e:
        error = ''
        for i in range(len(e.diagnostics.exceptions)):
            execption = e.diagnostics.exceptions[i]
            error += f'-------\n{type(e)} {i}:\n{execption.message}'
            
        return {'status': 'error', 'message': error}
    except SyntaxError as e:
        return {'status': 'error', 'message': f'-------\n{type(e)}:\n{str(e)}'}
    except ValueError as e:
        return {'status': 'error', 'message': f'-------\n{type(e)}:\n{str(e)}'}
    except Exception as e:
        return {'status': 'error', 'message': f'-------\n{type(e)}:\n{str(e)}'}

for line in sys.stdin:
    request = json.loads(line)
    
    if request["mode"] == 'tokens':
        function = request["text"]
        config = request["config"] if 'config' in request else ''
        # sys.stdin.flush()
        print("data: " + json.dumps(grabTokens(function, config)))
        # print(function, config)
    # print(line)
    sys.stdout.flush()