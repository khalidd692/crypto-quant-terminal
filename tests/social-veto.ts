import assert from "node:assert/strict";import{applySocialVeto}from"../src/surveillance/social-veto.js";
const base={mentions:100,mentionChangePct:1.2,toneScore:.4,concentrationTop5Pct:.7,attentionSpike:true,temperature:"HOT" as const,label:"indice de température, bruité et manipulable, pas une prévision",sourceAsOf:"2026-10-08T00:00:00Z",} as const;
assert.equal(applySocialVeto("ENTRER",base).decision,"ATTENDRE");
assert.equal(applySocialVeto("ATTENDRE",base).decision,"ATTENDRE");
assert.equal(applySocialVeto("ENTRER",{...base,temperature:"UNAVAILABLE"}).decision,"ATTENDRE");
assert.equal(applySocialVeto("ENTRER",{...base,temperature:"LOW"}).decision,"ENTRER");
console.log("cpp social veto: PASS");