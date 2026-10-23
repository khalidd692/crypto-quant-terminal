import assert from "node:assert/strict";
import { calculateSpreadBps, conservativeTelSpread, spreadFromOrderBook } from "../src/context/providers/liquidity.js";

const kucoinBook = {
  code: "200000",
  data: {
    bids: [["0.0120", "1000"], ["0.0119", "2000"]],
    asks: [["0.0122", "800"], ["0.0123", "1200"]],
  },
};
const mexcBook = {
  lastUpdateId: 123,
  bids: [["0.0118", "1000"], ["0.0117", "2000"]],
  asks: [["0.0124", "800"], ["0.0125", "1200"]],
};

const kucoinSpread = spreadFromOrderBook(kucoinBook);
const mexcSpread = spreadFromOrderBook(mexcBook);
assert.ok(kucoinSpread !== null && kucoinSpread > 0);
assert.ok(mexcSpread !== null && mexcSpread > kucoinSpread);
assert.equal(conservativeTelSpread(kucoinSpread, mexcSpread), mexcSpread);
assert.equal(conservativeTelSpread(kucoinSpread, null), kucoinSpread);
assert.equal(conservativeTelSpread(null, null), null);
assert.equal(spreadFromOrderBook({ bids: [], asks: [] }), null);
assert.equal(spreadFromOrderBook({ bids: [["0", "5"]], asks: [["0.1", "5"]] }), null);
assert.equal(calculateSpreadBps(100, 101), (1 / 100.5) * 10000);
assert.equal(calculateSpreadBps(101, 100), null);

console.log("live TEL order-book spread parsing: PASS");
