import { reconstructGrossReturnFraction } from "../src/research/phase3-diagnostics.js";

// Simulator convention: returnFraction is already net of fees; slippageReturn
// is signed (slipped return minus slippage-free return), normally <= 0.
const gross = reconstructGrossReturnFraction(0.012, 0.0008, -0.0004);
const netExcludingFunding = 0.012;
const feeCost = 0.0008;
const slippageCost = 0.0004;
const observedCost = gross - netExcludingFunding;
if (Math.abs(observedCost - (feeCost + slippageCost)) > 1e-12) {
  throw new Error(`gross - net excluding funding must equal fees + slippage: ${observedCost}`);
}
if (observedCost < 0) throw new Error("Gross return must not be below net excluding funding when costs are positive");

// Funding is a separate signed component and must not enter gross reconstruction.
const fundingReturn = -0.0002;
const netIncludingFunding = netExcludingFunding + fundingReturn;
if (Math.abs((gross - netIncludingFunding) - (feeCost + slippageCost - fundingReturn)) > 1e-12) {
  throw new Error("Funding must remain separate from gross-versus-net cost reconciliation");
}
console.log("phase3-diagnostic-cost-accounting: ok");
