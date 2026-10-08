import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const ROOT=resolve(process.cwd(),"src","research","advanced_lab");
const SOURCE_EXTENSIONS=new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs",".py"]);
const FORBIDDEN_LITERAL=/holdout|terminal|surveillance/i;
const violations:string[]=[];
function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const path=join(dir,entry.name);return entry.isDirectory()?walk(path):[path];});}
function record(file:string,reason:string){violations.push(relative(process.cwd(),file)+": "+reason);}
function outsideLab(candidate:string):boolean{const rel=relative(ROOT,normalize(candidate));return rel!==""&&(rel.startsWith("..")||isAbsolute(rel));}
function checkResolvedImport(file:string,specifier:string){if(!specifier.startsWith("."))return;const candidate=resolve(dirname(file),specifier);if(outsideLab(candidate))record(file,"import path outside lab: "+specifier);}
function checkPython(file:string,source:string){
 const script=["import ast,json,sys","t=ast.parse(sys.stdin.read())","out=[]","for n in ast.walk(t):","  if isinstance(n,ast.Import): out += [a.name for a in n.names]","  elif isinstance(n,ast.ImportFrom): out.append('.'*n.level + (n.module or ''))","print(json.dumps(out))"].join("\n");
 const p=spawnSync("python3",["-c",script],{input:source,encoding:"utf8"});
 if(p.status!==0){record(file,"Python AST parse failed");return;}
 for(const spec of JSON.parse(p.stdout) as string[]){if(spec.startsWith("."))checkResolvedImport(file,spec);}
}
for(const file of walk(ROOT)){
 if(!SOURCE_EXTENSIONS.has(extname(file)))continue;
 const source=readFileSync(file,"utf8");
 if(FORBIDDEN_LITERAL.test(source))record(file,"forbidden literal: holdout/terminal/surveillance");
 if(extname(file)===".py")checkPython(file,source);
 else{
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  ast.forEachChild(node=>{if(ts.isImportDeclaration(node)){const spec=node.moduleSpecifier;if(ts.isStringLiteral(spec))checkResolvedImport(file,spec.text);}if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==="require"){const arg=node.arguments[0];if(arg&&ts.isStringLiteral(arg))checkResolvedImport(file,arg.text);}});
 }
}
if(violations.length){console.error("Advanced lab isolation violations:");console.error(violations.join("\n"));process.exit(1);}
console.log("Advanced lab isolation: OK");
