import {readdirSync,readFileSync,statSync} from "node:fs";
import {join,relative} from "node:path";

const ROOT=join(process.cwd(),"src","research","advanced_lab");
const SOURCE_EXTENSIONS=new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs"]);

function walk(dir:string):string[]{
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const path=join(dir,entry.name);
    return entry.isDirectory()?walk(path):[path];
  });
}

const forbidden=[
  /(?:^|[\/'"])(?:\.\.\/)+holdout(?:[\/'"]|$)/,
  /(?:^|[\/'"])(?:\.\.\/)+terminal(?:[\/'"]|$)/,
  /(?:^|[\/'"])src\/(?:holdout|terminal)(?:[\/'"]|$)/,
  /(?:from|import|require)\s*\(?\s*["'][^"']*\/(?:holdout|terminal)(?:\/[^"]*)?["']/,
];

const violations:string[]=[];
for(const file of walk(ROOT)){
  if(!SOURCE_EXTENSIONS.has(file.slice(file.lastIndexOf(".")))) continue;
  const source=readFileSync(file,"utf8");
  for(const pattern of forbidden){
    if(pattern.test(source)){
      violations.push(relative(process.cwd(),file));
      break;
    }
  }
}

if(violations.length){
  throw new Error("Advanced lab isolation violation: "+violations.join(", "));
}
console.log("Advanced lab isolation: OK");
