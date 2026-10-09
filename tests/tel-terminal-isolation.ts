import { readFile } from "node:fs/promises";

// Tests execute from the repository root through npm test. Resolve source paths
// from process.cwd(), not import.meta.url, because compiled tests live in dist/.
const source=await readFile("src/surveillance/tel-usdt.ts","utf8");
const mobile=await readFile("src/surveillance/tel-mobile.ts","utf8");
if(/terminal\//.test(source)||/from ["']\.\.?\/terminal\//.test(source)) throw new Error("TEL surveillance must not import terminal BTC estimator");
if(/terminal\//.test(mobile)||/from ["']\.\.?\/terminal\//.test(mobile)) throw new Error("TEL mobile renderer must not import terminal BTC estimator");
console.log("tel-terminal-isolation: PASS");
