'use client';
import {useState} from 'react';
import {readAPI,type Report} from '../diagnostics';

export function GeminiEvidence({report,enabled}:{report:Report;enabled:boolean}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<{names:string[];action:string}|null>(null);
 async function ask(){
  if(busy)return;
  setBusy(true);setError('');setResult(null);
  try{
   const result=await readAPI('/explain',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({run_id:report.id,consent:true})}) as {evidence_ids:unknown;next_action:unknown};
   if(!Array.isArray(result.evidence_ids)||typeof result.next_action!=='number')throw new Error('Invalid evidence selection.');
   const names=result.evidence_ids.map(id=>report.measurements.find(item=>item.id===id)?.label).filter((v):v is string=>!!v);
   const action=report.actions[result.next_action];
   if(!names.length||!action)throw new Error('Invalid evidence selection.');
   setResult({names,action});
  }catch{
   setError('Gemini is unavailable for this run. Start a new measured check on this PC and confirm the AI Studio key is configured. Your diagnosis is unchanged.');
  }finally{setBusy(false)}
 }
 return <section className="panel gemini-panel no-print" aria-label="Gemini evidence assist">
  <span className="module-index">OPTIONAL / GEMINI</span><h3>Focus on the strongest evidence</h3>
  <p>Sends selected readings, the verdict, and approved actions from this run to Google. Network addresses aren’t included. The diagnosis stays as measured.</p>
  {!enabled&&<p>Start the local collector with an AI Studio key to enable Gemini. The report works without it.</p>}
  <button className="button secondary" type="button" disabled={busy||!enabled} onClick={()=>void ask()}>{busy?'Reviewing evidence…':'Share readings and explain'}</button>
  {error&&<p role="status">{error}</p>}
  {result&&<div role="status"><p><strong>Focus on:</strong> {result.names.join(', ')}</p><p><strong>Suggested next step:</strong> {result.action}</p></div>}
 </section>;
}
