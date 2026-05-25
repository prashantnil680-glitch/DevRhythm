const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class PythonMetadataExtractor {
  extract(starterCode) {
    if (!starterCode || typeof starterCode !== 'string' || starterCode.trim() === '') {
      throw new Error('Invalid starter code: empty or not a string');
    }

    try {
      return this._extractWithAST(starterCode);
    } catch (astError) {
      throw new Error(`AST extraction failed for Python code: ${astError.message}`);
    }
  }

  _extractWithAST(starterCode) {
    const tempScriptPath = path.join(os.tmpdir(), `_ast_extractor_${Date.now()}.py`);
    const analysisScript = `
import ast
import json
import sys
from typing import get_origin, get_args, Optional, Union, List, Dict, Set, Tuple

def parse_type_string(type_str):
    """Parse a type string (e.g., 'Optional[Node]') into an AST node and return its canonical string."""
    try:
        tree = ast.parse(f"x: {type_str}")
        annotation = tree.body[0].annotation
        return get_type_string(annotation)
    except:
        return type_str

def get_type_string(annotation_node):
    """Convert an AST annotation node into a canonical type string."""
    if annotation_node is None:
        return "Any"
    
    if isinstance(annotation_node, ast.Constant):
        if annotation_node.value is None:
            return "None"
        if isinstance(annotation_node.value, str):
            # Forward reference: the string contains a type expression
            return parse_type_string(annotation_node.value)
        return repr(annotation_node.value)
    
    if isinstance(annotation_node, ast.Name):
        return annotation_node.id
    
    if isinstance(annotation_node, ast.Subscript):
        base = get_type_string(annotation_node.value)
        if base in ('Optional', 'Union'):
            if isinstance(annotation_node.slice, ast.Index):
                slice_node = annotation_node.slice.value
            else:
                slice_node = annotation_node.slice
            if isinstance(slice_node, ast.Tuple):
                inner_types = [get_type_string(elt) for elt in slice_node.elts]
            else:
                inner_types = [get_type_string(slice_node)]
            if base == 'Optional':
                return f"{inner_types[0]} | None"
            else:
                return f"Union[{', '.join(inner_types)}]"
        else:
            if isinstance(annotation_node.slice, ast.Index):
                slice_node = annotation_node.slice.value
            else:
                slice_node = annotation_node.slice
            if isinstance(slice_node, ast.Tuple):
                inner = ', '.join(get_type_string(elt) for elt in slice_node.elts)
            else:
                inner = get_type_string(slice_node)
            return f"{base}[{inner}]"
    
    if isinstance(annotation_node, ast.Attribute):
        if annotation_node.attr in ('Optional', 'Union', 'List', 'Dict', 'Set', 'Tuple'):
            return annotation_node.attr
        return annotation_node.attr
    
    if isinstance(annotation_node, ast.BinOp) and isinstance(annotation_node.op, ast.BitOr):
        left = get_type_string(annotation_node.left)
        right = get_type_string(annotation_node.right)
        return f"{left} | {right}"
    
    return "Any"

def analyze(code):
    tree = ast.parse(code)
    class_name = None
    method_name = None
    return_type = "Any"
    parameters = []
    data_structures = set()
    interactive = False
    methods = []
    constructor_params = []
    
    classes = [node for node in tree.body if isinstance(node, ast.ClassDef)]
    target_class = None
    for cls in classes:
        if cls.name == "Solution":
            target_class = cls
            break
    if not target_class and len(classes) == 1:
        target_class = classes[0]
        interactive = True
    if target_class:
        class_name = target_class.name
        methods_in_class = [node for node in target_class.body if isinstance(node, ast.FunctionDef)]
        if len(methods_in_class) > 1:
            interactive = True
        
        for func in methods_in_class:
            if func.name == "__init__":
                for arg in func.args.args[1:]:
                    arg_name = arg.arg
                    arg_type = get_type_string(arg.annotation) if arg.annotation else "Any"
                    constructor_params.append(arg_type)
                break
        
        main_method = None
        for func in methods_in_class:
            if func.name != "__init__":
                main_method = func
                break
        if not main_method and methods_in_class:
            main_method = methods_in_class[0]
        
        if main_method:
            method_name = main_method.name
            if main_method.returns:
                return_type = get_type_string(main_method.returns)
            
            for arg in main_method.args.args[1:]:
                arg_name = arg.arg
                arg_type = get_type_string(arg.annotation) if arg.annotation else "Any"
                parameters.append({"name": arg_name, "type": arg_type})
                if any(ds in arg_type for ds in ("ListNode", "TreeNode", "Node", "NestedInteger")):
                    data_structures.add(arg_type.split('[')[0])
            
            if any(ds in return_type for ds in ("ListNode", "TreeNode", "Node", "NestedInteger")):
                data_structures.add(return_type.split('[')[0])
        
        for func in methods_in_class:
            if func.name == "__init__":
                continue
            ret_type = get_type_string(func.returns) if func.returns else "Any"
            param_types = []
            for arg in func.args.args[1:]:
                ptype = get_type_string(arg.annotation) if arg.annotation else "Any"
                param_types.append(ptype)
            methods.append({
                "name": func.name,
                "returnType": ret_type,
                "parameters": param_types
            })
    else:
        top_functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
        if top_functions:
            func = top_functions[0]
            method_name = func.name
            return_type = get_type_string(func.returns) if func.returns else "Any"
            parameters = []
            for arg in func.args.args:
                arg_name = arg.arg
                arg_type = get_type_string(arg.annotation) if arg.annotation else "Any"
                parameters.append({"name": arg_name, "type": arg_type})
                if any(ds in arg_type for ds in ("ListNode", "TreeNode", "Node", "NestedInteger")):
                    data_structures.add(arg_type.split('[')[0])
            if any(ds in return_type for ds in ("ListNode", "TreeNode", "Node", "NestedInteger")):
                data_structures.add(return_type.split('[')[0])
        else:
            raise ValueError("No class or function found in starter code")
    
    if interactive and len(methods) == 0 and method_name:
        methods.append({
            "name": method_name,
            "returnType": return_type,
            "parameters": [p["type"] for p in parameters]
        })
    
    result = {
        "className": class_name,
        "methodName": method_name,
        "returnType": return_type,
        "parameters": parameters,
        "dataStructures": list(data_structures),
        "interactive": interactive,
        "methods": methods,
        "constructorParams": constructor_params
    }
    if not result["parameters"]:
        result["parameters"] = []
    if not result["methods"]:
        result["methods"] = []
    if not result["dataStructures"]:
        result["dataStructures"] = []
    if not result["constructorParams"]:
        result["constructorParams"] = []
    print(json.dumps(result))

if __name__ == "__main__":
    code = sys.stdin.read()
    try:
        analyze(code)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
`;
    fs.writeFileSync(tempScriptPath, analysisScript, { encoding: 'utf8', mode: 0o600 });
    let output;
    try {
      output = execSync(`python "${tempScriptPath}"`, {
        input: starterCode,
        encoding: 'utf-8',
        timeout: 5000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (execError) {
      let errorMessage = execError.message;
      if (execError.stderr) errorMessage += `\n${execError.stderr}`;
      throw new Error(`Python AST extraction failed: ${errorMessage}`);
    } finally {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }

    let result;
    try {
      result = JSON.parse(output);
    } catch (parseError) {
      throw new Error(`Failed to parse Python AST output: ${parseError.message}\nOutput: ${output.substring(0, 200)}`);
    }

    if (result.error) {
      throw new Error(`Python AST analysis error: ${result.error}`);
    }

    if (!result.methodName) {
      throw new Error('No method name extracted from Python code');
    }

    return result;
  }
}

module.exports = PythonMetadataExtractor;