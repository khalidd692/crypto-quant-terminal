import { existsSync, readFileSync } from "node:fs";

export interface ManualTelUnlockEvent { readonly date: string; readonly amount?: number; readonly note?: string; }
export interface ManualTelUnlockResult {
  readonly status: "OK" | "UNAVAILABLE";
  readonly source_url: string | null;
  readonly retrieved_at: string | null;
  readonly valid_until: string | null;
  readonly events: readonly ManualTelUnlockEvent[];
  readonly reason: string | null;
}
const unavailable=(reason:string):ManualTelUnlockResult=>({status:"UNAVAILABLE",source_url:null,retrieved_at:null,valid_until:null,events:[],reason});
export function normalizeManualTelUnlocks(value:unknown,now:string):ManualTelUnlockResult {
  if(!value||typeof value!=="object"||Array.isArray(value))return unavailable("MANUAL_TEL_UNLOCKS_INVALID_SCHEMA");
  const x=value as Record<string,unknown>, source=x.source_url, retrieved=x.retrieved_at, until=x.valid_until;
  if(typeof source!=="string")return unavailable("MANUAL_TEL_UNLOCKS_SOURCE_URL_MISSING");
  try{const u=new URL(source);if(u.protocol!=="https:")return unavailable("MANUAL_TEL_UNLOCKS_SOURCE_URL_MUST_BE_HTTPS");}catch{return unavailable("MANUAL_TEL_UNLOCKS_SOURCE_URL_INVALID");}
  if(typeof retrieved!=="string"||!Number.isFinite(Date.parse(retrieved)))return unavailable("MANUAL_TEL_UNLOCKS_RETRIEVED_AT_INVALID");
  if(typeof until!=="string"||!Number.isFinite(Date.parse(until)))return unavailable("MANUAL_TEL_UNLOCKS_VALID_UNTIL_INVALID");
  const nowMs=Date.parse(now), retrievedMs=Date.parse(retrieved), untilMs=Date.parse(until);
  if(!Number.isFinite(nowMs))return unavailable("MANUAL_TEL_UNLOCKS_CLOCK_INVALID");
  if(retrievedMs>nowMs)return unavailable("MANUAL_TEL_UNLOCKS_RETRIEVED_AT_IN_FUTURE");
  if(untilMs<=nowMs)return unavailable("MANUAL_TEL_UNLOCKS_EXPIRED");
  if(untilMs<=retrievedMs)return unavailable("MANUAL_TEL_UNLOCKS_VALIDITY_WINDOW_INVALID");
  if(!Array.isArray(x.events))return unavailable("MANUAL_TEL_UNLOCKS_EVENTS_MISSING");
  const events:ManualTelUnlockEvent[]=[];
  for(const raw of x.events){if(!raw||typeof raw!=="object"||Array.isArray(raw))return unavailable("MANUAL_TEL_UNLOCKS_EVENT_INVALID");const e=raw as Record<string,unknown>;if(typeof e.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date+"T00:00:00Z")))return unavailable("MANUAL_TEL_UNLOCKS_EVENT_DATE_INVALID");if(e.amount!==undefined&&(typeof e.amount!=="number"||!Number.isFinite(e.amount)||e.amount<0))return unavailable("MANUAL_TEL_UNLOCKS_EVENT_AMOUNT_INVALID");if(e.note!==undefined&&typeof e.note!=="string")return unavailable("MANUAL_TEL_UNLOCKS_EVENT_NOTE_INVALID");events.push({date:e.date,...(e.amount===undefined?{}:{amount:e.amount}),...(e.note===undefined?{}:{note:e.note})});}
  return {status:"OK",source_url:source,retrieved_at:retrieved,valid_until:until,events,reason:null};
}
export function readManualTelUnlocksFile(path:string,now:string):ManualTelUnlockResult {
  if(!existsSync(path))return unavailable("MANUAL_TEL_UNLOCKS_FILE_ABSENT");
  try{return normalizeManualTelUnlocks(JSON.parse(readFileSync(path,"utf8")),now);}catch{return unavailable("MANUAL_TEL_UNLOCKS_FILE_INVALID_JSON");}
}
