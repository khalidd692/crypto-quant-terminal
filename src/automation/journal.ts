import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
export type JournalDecision = "ENTRER"|"ATTENDRE"|"SORTIR"|"NE_PAS_ENTRER"|"ALERTE"|"SUIVI_1J"|"SUIVI_3J"|"SUIVI_7J";
export interface ProspectiveJournalRecord {
  readonly schemaVersion:"prospective-journal.v1"; readonly recordedAt:string; readonly assetId:string; readonly decision:JournalDecision|string;
  readonly reasons:readonly string[]; readonly snapshotHash:string; readonly previousHash:string|null; readonly recordHash:string;
  readonly priceQuote?:number; readonly mode?: "TEST_SANS_ARGENT"|"MANUAL_TRADE"|"SYSTEM"; readonly referenceRecordHash?:string;
  readonly horizonDays?:1|3|7; readonly returnPct?:number|null; readonly observationCount?:number;
}
function canonical(record:Omit<ProspectiveJournalRecord,"recordHash">):string{return JSON.stringify(record);}
function hash(record:Omit<ProspectiveJournalRecord,"recordHash">):string{return createHash("sha256").update(canonical(record)).digest("hex");}
export function appendProspectiveRecord(path:string,input:Omit<ProspectiveJournalRecord,"previousHash"|"recordHash">):ProspectiveJournalRecord{
  const previous=readProspectiveJournal(path).at(-1)?.recordHash??null; const base={...input,previousHash:previous}; const record={...base,recordHash:hash(base)};
  appendFileSync(path,JSON.stringify(record)+"\n",{encoding:"utf8"}); return record;
}
export function readProspectiveJournal(path:string):ProspectiveJournalRecord[]{
  if(!existsSync(path))return []; const lines=readFileSync(path,"utf8").split("\n").map(x=>x.trim()).filter(Boolean); let previous:string|null=null;
  return lines.map((line,index)=>{const record=JSON.parse(line) as ProspectiveJournalRecord;if(record.schemaVersion!=="prospective-journal.v1")throw new Error(`Unsupported journal schema at line ${index+1}`);if(record.previousHash!==previous)throw new Error(`Prospective journal chain mismatch at line ${index+1}`);const{recordHash:_ignored,...base}=record;if(hash(base)!==record.recordHash)throw new Error(`Prospective journal hash mismatch at line ${index+1}`);previous=record.recordHash;return record;});
}
export function appendFollowUp(path:string,origin:ProspectiveJournalRecord,horizonDays:1|3|7,priceQuote:number,observedAt:string):ProspectiveJournalRecord{
  if(!Number.isFinite(priceQuote)||priceQuote<=0)throw new Error("Invalid follow-up price");
  if(origin.priceQuote===undefined||origin.priceQuote<=0)throw new Error("Origin record has no price");
  const returnPct=priceQuote/origin.priceQuote-1;
  return appendProspectiveRecord(path,{schemaVersion:"prospective-journal.v1",recordedAt:observedAt,assetId:origin.assetId,decision:(`SUIVI_${horizonDays}J`) as JournalDecision,reasons:["Suivi prospectif du signal initial; statistique historique, pas une prévision."],snapshotHash:origin.snapshotHash,mode:"SYSTEM",referenceRecordHash:origin.recordHash,horizonDays,priceQuote,returnPct});
}
