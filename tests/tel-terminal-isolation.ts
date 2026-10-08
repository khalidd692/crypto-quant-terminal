import { readFile } from "node:fs/promises";
const source=await readFile(new URL("../src/surveillance/tel-usdt.ts",import.meta.url),"utf8");
const mobile=await readFile(new URL("../src/surveillance/tel-mobile.ts",import.meta.url),"utf8");
if(/terminal\//.test(source)||/from ["']\.\.?\/terminal\//.test(source)) throw new Error("TEL surveillance must not import terminal BTC estimator");
if(/terminal\//.test(mobile)||/from ["']\.\.?\/terminal\//.test(mobile)) throw new Error("TEL mobile renderer must not import terminal BTC estimator");