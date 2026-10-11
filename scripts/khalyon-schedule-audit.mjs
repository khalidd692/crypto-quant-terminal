import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
const repo=process.env.GITHUB_REPOSITORY, token=process.env.GITHUB_TOKEN, runId=process.env.GITHUB_RUN_ID;
const measuredAt=new Date().toISOString(), measuredMs=Date.parse(measuredAt);
if(!repo||!token||!runId) throw new Error("Missing GitHub Actions metadata; audit cannot be verified.");
const runtime=JSON.parse(readFileSync(resolve("khalyon/data/runtime.json"),"utf8"));
const generatedMs=Date.parse(runtime.generatedAt||"");
if(!Number.isFinite(generatedMs)||generatedMs>measuredMs) throw new Error("runtime.json generatedAt missing, invalid, or in future.");
async function api(url){const r=await fetch(url,{headers:{accept:"application/vnd.github+json",authorization:"Bearer "+token,"x-github-api-version":"2022-11-28"}});if(!r.ok)throw new Error("GitHub Actions history unavailable: HTTP "+r.status);return r.json();}
const sinceMs=measuredMs-7*86400000;
const history=await api("https://api.github.com/repos/"+repo+"/actions/workflows/khalyon-pages.yml/runs?per_page=100&created=>="+new Date(sinceMs).toISOString().slice(0,10));
const runs=history.workflow_runs.filter(r=>r.id!==Number(runId)&&r.event==="schedule"&&r.conclusion==="success"&&Date.parse(r.updated_at)>=sinceMs&&Date.parse(r.updated_at)<=measuredMs);
const current=await api("https://api.github.com/repos/"+repo+"/actions/runs/"+runId);
const actualStart=current.run_started_at||current.created_at;
const cronMinutes=[7,22,37,52];
function slotProxy(stamp){const d=new Date(stamp), m=d.getUTCMinutes(), chosen=cronMinutes.slice().reverse().find(x=>x<=m);if(chosen!==undefined)d.setUTCMinutes(chosen,0,0);else d.setUTCHours(d.getUTCHours()-1,52,0,0);return d.toISOString();}
const sorted=runs.map(r=>({id:r.id,started:Date.parse(r.run_started_at||r.created_at),finished:Date.parse(r.updated_at)})).filter(r=>Number.isFinite(r.started)).sort((a,b)=>a.started-b.started);
const gaps=[];for(let i=1;i<sorted.length;i++){const gap=sorted[i].started-sorted[i-1].started;if(gap>1800000)gaps.push({fromRun:sorted[i-1].id,toRun:sorted[i].id,gapMinutes:Math.round(gap/60000),expectedSlotsBetween:Math.max(0,Math.floor(gap/900000)-1)});}
const intervals=runs.map(r=>[Date.parse(r.updated_at),Math.min(Date.parse(r.updated_at)+1800000,measuredMs)]).filter(x=>Number.isFinite(x[0])&&x[0]<measuredMs).sort((a,b)=>a[0]-b[0]);
intervals.push([measuredMs,measuredMs]);let covered=0,left=null,right=null;for(const [a,b] of intervals){if(right===null){left=a;right=b;}else if(a<=right)right=Math.max(right,b);else{covered+=Math.max(0,right-left);left=a;right=b;}}if(right!==null)covered+=Math.max(0,right-left);
const audit={schemaVersion:1,windowDays:7,cron:"7,22,37,52 * * * *",timezone:"UTC",measuredAt,expectedSlotProxy:slotProxy(actualStart),expectedSlotNote:"GitHub does not expose the original scheduled tick timestamp; this is a proxy, not proof of scheduler intent.",actualStartedAt:actualStart,measuredBeforePagesUpload:true,runtimeGeneratedAt:runtime.generatedAt,runtimeAgeSecondsAtMeasurement:Math.floor((measuredMs-generatedMs)/1000),currentRunId:Number(runId),currentRunDurationSecondsAtMeasurement:Math.max(0,Math.floor((measuredMs-Date.parse(actualStart))/1000)),successfulScheduledRunsInWindow:runs.length,scheduleGaps:gaps,gapCount:gaps.length,missedSlotsConfirmed:null,missedSlotsReason:"Cadence gaps are observed, but exact skipped cron ticks cannot be proven from the Actions run metadata.",estimatedFreshnessCoveragePercent:Math.round(Math.min(100,covered/604800000*10000))/100,freshnessCoverageMethod:"Estimate from union of 30-minute intervals after successful scheduled run completion times in available 7-day Actions history; not per-second telemetry.",historyRunsReturned:history.workflow_runs.length};
const out=resolve("khalyon/data/schedule-audit.json");mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(audit,null,2)+"\n");console.log(JSON.stringify(audit,null,2));