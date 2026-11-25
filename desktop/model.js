(function(root,factory){const a=factory();if(typeof module==='object')module.exports=a;else root.ND=a;})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const fixtures=typeof module==='object'?require('./demo-data.js'):globalThis.ND_FIXTURES;
const scenarios=fixtures.map(({id,title,description})=>({id,title,description}));
const scrub=v=>String(v??'').replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[address removed]').replace(/\b(?:[\da-f]{1,4}:){2,7}[\da-f]{0,4}\b/gi,'[address removed]').replace(/\b(?:[\da-f]{2}[:-]){5}[\da-f]{2}\b/gi,'[identifier removed]').replace(/[\w.!#$%&'*+\/=?^_`{|}~-]+@[\w.-]+\.[a-z]{2,}/gi,'[email removed]').slice(0,750);
const labScenarios=[
 {id:'gateway',title:'Gateway unreachable',description:'The isolated test gateway refuses the local check.'},
 {id:'dns',title:'DNS failure',description:'The isolated resolver returns a failure response.'},
 {id:'packet_loss',title:'Induced packet loss',description:'The isolated lab intentionally drops selected probe packets.'},
 {id:'congestion',title:'Congestion',description:'The isolated lab delays probes to model a saturated connection.'},
 {id:'ambiguous',title:'Ambiguous evidence',description:'Mixed measured signals require an inconclusive result.'},
 {id:'control',title:'Clean lab baseline',description:'Measure the isolated loopback environment without a controlled fault.'}
];
const source=r=>r?.mode==='live'?'python-host':r?.provenance?.source==='controlled-loopback'?'controlled-loopback':'fixture';
const typeLabel=r=>({'python-host':'LIVE / THIS COMPUTER','controlled-loopback':'CONTROLLED LAB / MEASURED LOOPBACK','fixture':'CONTROLLED DEMO / SYNTHETIC'})[source(r)];
const safeId=v=>String(v??'').replace(/[^\w-]/g,'').slice(0,60)||'evidence';
const list=v=>Array.isArray(v)?v.slice(0,20).map(scrub):[];
const access=v=>['wifi','ethernet','unknown'].includes(v)?v:'unknown';
function normalize(r){
  if(!r||typeof r!=='object'||!r.diagnosis||!Array.isArray(r.measurements)||!['demo','live'].includes(r.mode))throw Error('Invalid report');
  return {id:safeId(r.id),mode:r.mode,scenario:r.scenario?safeId(r.scenario):null,created_at:Number.isFinite(Date.parse(r.created_at))?new Date(r.created_at).toISOString():new Date().toISOString(),access:access(r.access),diagnosis:{code:safeId(r.diagnosis.code),title:scrub(r.diagnosis.title),confidence:scrub(r.diagnosis.confidence),summary:scrub(r.diagnosis.summary)},measurements:r.measurements.slice(0,30).map(x=>({id:safeId(x.id),label:scrub(x.label),value:typeof x.value==='number'&&Number.isFinite(x.value)?x.value:typeof x.value==='boolean'?x.value:x.value==null?null:scrub(x.value),unit:scrub(x.unit),status:scrub(x.status),detail:scrub(x.detail)})),evidence:list(r.evidence),actions:list(r.actions),limitations:list(r.limitations),provenance:{source:source(r),schema_version:scrub(r.provenance?.schema_version),ruleset:scrub(r.provenance?.ruleset),gateway_sample_ms:Array.isArray(r.provenance?.gateway_sample_ms)?r.provenance.gateway_sample_ms.slice(0,20).map(x=>typeof x==='number'&&Number.isFinite(x)?x:null):[],...(typeof r.provenance?.expected==='string'?{expected:safeId(r.provenance.expected)}:{}),...(typeof r.provenance?.passed==='boolean'?{passed:r.provenance.passed}:{})}};
}
function makeDemo(id,network){
  const f=fixtures.find(c=>c.id===id);if(!f)throw Error('Choose a valid controlled scenario.');
  return normalize({...f.report,id:'demo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),created_at:new Date().toISOString(),access:id==='wifi'?'wifi':access(network)});

}
function compare(prior,next){
  if(!prior||!next||source(prior)!==source(next)||prior.access!==next.access||(next.mode==='demo'&&prior.scenario!==next.scenario&&!(source(next)==='controlled-loopback'&&next.scenario==='control')))return [];
  return next.measurements.flatMap(x=>{const a=prior.measurements.find(n=>n.id===x.id&&n.unit===x.unit);return a&&typeof a.value==='number'&&typeof x.value==='number'?[{label:x.label,unit:x.unit,from:a.value,to:x.value,delta:Math.round((x.value-a.value)*100)/100}]:[]});
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function html(value){
  const r=normalize(value);
  const ul=items=>'<ul>'+items.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>';
  const rows=r.measurements.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+esc(x.value??'Not available')+' '+(x.value==null?'':esc(x.unit))+'</td><td>'+esc(x.status)+'</td></tr>').join('');
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NetDoctor evidence</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:0 24px;color:#172639}h1{margin-bottom:4px}header{border-bottom:2px solid #12786c;padding-bottom:12px}small{color:#415868}td,th{text-align:left;padding:10px;border-bottom:1px solid #c3d8d7}table{border-collapse:collapse;width:100%}section{margin:24px 0}</style><header><small>NETDOCTOR • AIORI PS-015</small><h1>'+esc(r.diagnosis.title)+'</h1><p>'+esc(typeLabel(r))+'</p><small>'+esc(r.created_at)+' | '+esc(r.access)+' | Confidence: '+esc(r.diagnosis.confidence)+'</small></header><section><p>'+esc(r.diagnosis.summary)+'</p><h2>Measurements</h2><table><thead><tr><th>Observation</th><th>Value</th><th>Signal</th></tr></thead><tbody>'+rows+'</tbody></table></section><section><h2>Why this result</h2>'+ul(r.evidence)+'<h2>Next steps</h2>'+ul(r.actions)+'<h2>Escalation note</h2><p>Tell support when the problem occurs, which devices are affected, and whether a matched retest showed the same pattern. Treat unavailable or conflicting observations as inconclusive; this is not proof of an ISP fault.</p><h2>Limitations</h2>'+ul(r.limitations)+'</section></html>';
}
return {scenarios,labScenarios,normalize,makeDemo,compare,html,source,typeLabel};
});
