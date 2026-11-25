const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const src=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
function session(diagnose){
 const dom=new JSDOM(src('index.html'),{url:'https://netdoctor.invalid/',runScripts:'outside-only'});
 const saves=[];
 dom.window.netdoctor={connect:async()=>true,diagnose,save:async (format,report)=>{saves.push({format,report});return true;}};
 for(const f of ['demo-data.js','model.js','src/result-view.js','src/judge-view.js','renderer.js'])dom.window.eval(src(f));
 const $=id=>dom.window.document.getElementById(id);
 return {dom,$,saves,action:label=>[...$('result').querySelectorAll('.actions button')].find(b=>b.textContent===label)};
}
test('theme toggles and persists in Electron renderer',async()=>{
 const s=session(()=>{});
 await delay(5);
 try{
  assert.equal(s.dom.window.document.documentElement.dataset.theme,'dark');
  s.$('theme-toggle').click();
  assert.equal(s.dom.window.document.documentElement.dataset.theme,'light');
  assert.equal(s.dom.window.localStorage.getItem('netdoctor.desktop.theme'),'light');
 }finally{s.dom.window.close()}
});
test('offline workflow, retest, export and local deletion via renderer',async()=>{
 const s=session(()=>{throw Error('Offline never uses local API')});
 try{
  s.$('demo').click();s.$('scenario').value='wifi';s.$('run').click();await delay(5);
  assert.match(s.$('result').textContent,/CONTROLLED DEMO \/ SYNTHETIC/);
  s.action('Retest').click();await delay(5);
  assert.match(s.$('result').textContent,/Matched retest comparison/);
  s.action('Export PDF').click();await delay(5);
  assert.equal(s.saves[0].format,'pdf');
  assert.equal(s.saves[0].report.provenance.source,'fixture');
  s.$('clear').click();
  assert.match(s.$('clear-prompt').textContent,/Remove saved reports/);
  s.$('clear').click();
  assert.match(s.$('history').textContent,/No runs yet/);
  assert.equal(s.dom.window.localStorage.getItem('netdoctor.desktop.history.v1'),'[]');
 }finally{s.dom.window.close()}
});
test('lab requires measured provenance, and a clean retest compares when matched',async()=>{
 let allowMeasured=false;
 const calls=[];
 const s=session(async (mode,access,scenario)=>{
  calls.push({mode,access,scenario});
  const report=s.dom.window.ND.makeDemo('wifi','wifi');
  report.access=access;
  report.scenario=scenario;
  if(allowMeasured)report.provenance.source='controlled-loopback';
  return report;
 });
 try{
  s.$('lab').click();s.$('scenario').value='gateway';s.$('run').click();await delay(5);
  assert.match(s.$('status').textContent,/wrong measurement mode/);
  assert.match(s.$('history').textContent,/No runs yet/);
  allowMeasured=true;
  s.$('run').click();await delay(5);
  assert.match(s.$('result').textContent,/MEASURED LOOPBACK/);
  s.action('Retest without fault').click();await delay(5);
  assert.match(s.$('result').textContent,/Before and after removing the lab fault/);
  assert.deepEqual(calls.map(x=>x.scenario),['gateway','gateway','control']);
 }finally{s.dom.window.close()}
});
test('live calls the host bridge without masquerading fixture data',async()=>{
 const calls=[];
 const s=session(async (mode,access)=>{
   calls.push({mode,access});
   const report=s.dom.window.ND.makeDemo('healthy',access);
   report.mode='live';report.scenario=null;report.provenance.source='python-host';
   return report;
 });
 try{
  s.$('live').click();s.$('access').value='ethernet';s.$('run').click();await delay(5);
  assert.match(s.$('result').textContent,/LIVE \/ THIS COMPUTER/);
  assert.deepEqual(calls,[{mode:'live',access:'ethernet'}]);
 }finally{s.dom.window.close()}
});

test('blind judge commits only on explicit reveal, then compares a clean retest',async()=>{
 let resolve, called;
 const s=session(async (mode,access,scenario)=>{
  const report=s.dom.window.ND.makeDemo('healthy','unknown');
  report.scenario=scenario;report.provenance.source='controlled-loopback';
  if(scenario!=='control'){
   report.diagnosis={code:'inconclusive',title:'Secret ambiguous diagnosis',summary:'Internal finding',confidence:'low'};
   report.measurements[1].value=29;called=scenario;
   return new Promise(done=>{resolve=()=>done(report)});
  }
  return report;
 });
 try{
  let random=6;
  s.dom.window.crypto.getRandomValues=a=>{a[0]=--random;return a};
  s.$('judge-toggle').click();
  assert.equal(s.$('normal-workspace').hidden,true);
  s.$('judge-card-5').click();
  assert.equal(called,'ambiguous');
  assert.equal(s.$('judge-reveal'),null);
  assert.equal(s.dom.window.localStorage.getItem('netdoctor.desktop.history.v1'),null);
  resolve();await delay(10);
  assert.match(s.$('judge-board').textContent,/MEASURED VERDICT \/ CONDITION SEALED/);
  assert.match(s.$('judge-board').textContent,/Inconclusive: no single cause isolated|What was observed/);
  assert.doesNotMatch(s.$('judge-board').textContent,/Secret ambiguous|Selected condition|Ambiguous evidence/i);
  assert.equal(s.dom.window.localStorage.getItem('netdoctor.desktop.history.v1'),null);
  s.$('judge-reveal').click();
  assert.match(s.$('judge-board').textContent,/Secret ambiguous diagnosis/);
  assert.match(s.$('judge-board').textContent,/Next safe action/);
  assert.equal(JSON.parse(s.dom.window.localStorage.getItem('netdoctor.desktop.history.v1'))[0].scenario,'ambiguous');
  s.$('judge-retest').click();await delay(10);
  assert.match(s.$('judge-board').textContent,/Before and after: clean control/);
  assert.match(s.$('judge-board').textContent,/29 → 5/);
  assert.equal(JSON.parse(s.dom.window.localStorage.getItem('netdoctor.desktop.history.v1'))[0].scenario,'control');
 }finally{s.dom.window.close()}
});
test('discarded blind round leaves no report in history',async()=>{
 const s=session(async (mode,access,scenario)=>{
  const report=s.dom.window.ND.makeDemo('healthy','unknown');
  report.scenario=scenario;report.provenance.source='controlled-loopback';return report;
 });
 try{
  s.$('judge-toggle').click();s.$('judge-card-1').click();await delay(10);
  s.$('judge-discard').click();s.$('judge-toggle').click();
  assert.equal(s.dom.window.localStorage.getItem('netdoctor.desktop.history.v1'),null);
  assert.match(s.$('history').textContent,/No runs yet/);
 }finally{s.dom.window.close()}
});
