const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const src=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
function session(diagnose, network, reverseDns, explain, checkDestination){
 const dom=new JSDOM(src('index.html'),{url:'https://netdoctor.invalid/',runScripts:'outside-only'});
 const saves=[];
 dom.window.netdoctor={connect:async()=>true,diagnose,network,reverseDns,explain,checkDestination,save:async (format,report)=>{saves.push({format,report});return true;}};
 for(const f of ['demo-data.js','model.js','src/result-view.js','src/judge-view.js','src/network-view.js','src/network-map.js','renderer.js'])dom.window.eval(src(f));
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
 const explained=[];
 let report;
 const s=session(async (mode,access)=>{
   calls.push({mode,access});
   report=s.dom.window.ND.makeDemo('healthy',access);
   report.mode='live';report.scenario=null;report.provenance.source='python-host';
   report.measurements=[
    ['gateway','Local route','Found',''],['latency','Gateway median latency',3,'ms'],['loss','Gateway probe loss',0,'%'],
    ['spread','Gateway latency range',4,'ms'],
    ['dns_1','DNS: www.cloudflare.com',37.2,'ms'],['https_1','HTTPS: www.cloudflare.com',398.6,'ms'],
    ['dns_2','DNS: www.google.com',45.9,'ms'],['https_2','HTTPS: www.google.com',433.2,'ms'],
    ['fixed_ip','Fixed-IP TCP probe','Reachable','']
   ].map(([id,label,value,unit])=>({id,label,value,unit,status:'pass'}));
   return report;
 },undefined,undefined,async id=>{
   explained.push(id);
   return {evidence_ids:[report.measurements[0].id],next_action:0};
 });
 try{
  s.$('live').click();s.$('access').value='ethernet';s.$('run').click();await delay(5);
  assert.match(s.$('result').textContent,/LIVE \/ THIS COMPUTER/);
  assert.deepEqual(calls,[{mode:'live',access:'ethernet'}]);
  assert.deepEqual(explained,[]);
  s.$('dashboard-ai').querySelector('button').click();
  await delay(5);
  assert.deepEqual(explained,[report.id]);
  assert.match(s.$('dashboard-ai').textContent,/Suggested next step/);
  assert.ok(s.$('dashboard-ai').textContent.includes(report.actions[0]));
  const changed=new Promise(resolve=>s.dom.window.addEventListener('hashchange',resolve,{once:true}));
  s.dom.window.document.querySelector('a[href="#diagnostics"]').click();
  await changed;
  assert.equal(s.$('diagnostics').hidden,false);
  assert.equal(s.$('normal-workspace').hidden,true);
  assert.ok(s.$('diagnostics-report').contains(s.$('result')));
  assert.ok(s.$('diagnostics-setup').contains(s.$('run')));
  assert.equal(s.$('result').querySelectorAll('tbody tr').length,report.measurements.length);
  assert.equal(s.$('diag-dns').textContent,'41.55 ms');
  assert.equal(s.$('diag-https').textContent,'415.9 ms');
  assert.equal(s.$('diag-loss').textContent,'0 %');
  assert.match(s.$('result').querySelector('tbody tr:last-child').textContent,/Fixed-IP TCP probeReachablePass/);
 }finally{s.dom.window.close()}
});

test('live is the default, follows the active route and resets traffic on an adapter switch',async()=>{
 let sample={state:'connected',id:'wifi-route',name:'Wi-Fi adapter',medium:'Wi-Fi',address:'192.168.1.3',
  gateways:['192.168.1.1'],sampledAt:1000,received:2000000,sent:1000000,linkSpeed:1000000000,
  usage:{apps:[['browser',2]],peers:[['203.0.113.3',2]],privateCount:0,publicCount:2}};
 const calls=[];
 const s=session(async (mode,access)=>{
  calls.push({mode,access});
  const report=s.dom.window.ND.makeDemo('healthy',access);
  report.mode='live';report.scenario=null;report.provenance.source='python-host';
  return report;
 },async()=>sample);
 try{
  await delay(5);
  assert.equal(s.$('live').getAttribute('aria-pressed'),'true');
  assert.equal(s.$('access').value,'auto');
  assert.equal(s.$('network-name').textContent,'Wi-Fi adapter');
  assert.match(s.$('network-apps').textContent,/browser/);
  assert.match(s.$('network-peers').textContent,/203\.0\.113\.3/);
  assert.equal(s.$('usage-count').textContent,'2');
  s.$('usage-view').value='peers';
  s.$('usage-view').dispatchEvent(new s.dom.window.Event('change'));
  assert.equal(s.$('network-apps').hidden,true);
  assert.equal(s.$('network-peers').hidden,false);
  s.$('traffic-range').value='60000';
  s.$('traffic-range').dispatchEvent(new s.dom.window.Event('change'));
  assert.match(s.$('traffic-chart').getAttribute('aria-label'),/Last minute/);
  sample={...sample,sampledAt:5000,received:6000000,sent:2000000};
  s.$('run').click();await delay(5);
  assert.equal(s.$('network-rx').textContent,'8 Mbps');
  assert.equal(s.$('diag-rx').textContent,'8 Mbps');
  assert.equal(s.$('network-tx').textContent,'2 Mbps');
  assert.equal(s.$('header-rx').textContent,'8 Mbps');
  assert.equal(s.$('title').textContent,'Your network is healthy');
  sample={...sample,id:'ethernet-route',name:'Ethernet adapter',medium:'Ethernet',
   address:'192.168.2.5',gateways:['192.168.2.1'],sampledAt:9000,usage:null};
  s.$('run').click();await delay(5);
  assert.equal(s.$('network-name').textContent,'Ethernet adapter');
  assert.equal(s.$('network-rx').textContent,'—');
  assert.deepEqual(calls,[{mode:'live',access:'wifi'},{mode:'live',access:'ethernet'}]);
  assert.doesNotMatch(s.dom.window.localStorage.getItem('netdoctor.desktop.history.v1'),/192\.168\.|203\.0\.113\.|browser/);
 }finally{s.dom.window.close()}
});

test('network map opens independently and shows measured TCP data for the selected app',async()=>{
 const requests=[];
 const lookups=[];
 const s=session(async()=>{},async selected=>{
  const warmup=selected==='chrome'&&!requests.includes('chrome');
  requests.push(selected);
  return {state:'connected',id:'wifi',name:'Wi-Fi adapter',medium:'Wi-Fi',address:'192.0.2.20',
   gateways:['192.0.2.1'],sampledAt:4000*requests.length,received:2000,sent:1000,
   packetsIn:12*requests.length,packetsOut:8*requests.length,
   map:{state:selected?'sampling':'off',selected,interval:selected&&!warmup?4000:null,apps:[
    {name:'chrome',count:2,measured:selected?1:0,destinations:[
     {address:'203.0.113.4',port:443,count:2,measured:selected?1:0,received:4000000,sent:1000000,
      segmentCoverage:1,segmentsIn:31,segmentsOut:12}]},
    {name:'firefox',count:1,measured:0,destinations:[
     {address:'203.0.113.5',port:443,count:1,measured:0}]}
   ]}};
 },async address=>{
  lookups.push(address);
  return address==='203.0.113.4'?{state:'found',names:['example.test']}:{state:'missing'};
 },undefined,async(app,address,port)=>{
  assert.deepEqual([app,address,port],['chrome','203.0.113.4',443]);
  return {status:'connected',elapsed:42};
 });
 try{
  const navigate=async selector=>{
   const changed=new Promise(resolve=>s.dom.window.addEventListener('hashchange',resolve,{once:true}));
   s.dom.window.document.querySelector(selector).click();
   await changed;
  };
  await delay(10);
  await navigate('a[href="#network-map"]');
  assert.equal(s.$('normal-workspace').hidden,true);
  assert.equal(s.$('network-map').hidden,false);
  assert.equal(s.$('map-app-name').textContent,'Google Chrome');
  assert.equal(s.$('map-metrics').hidden,true);
  assert.equal(s.$('map-destinations').querySelector('tr').cells.length,3);
  assert.match(s.$('map-destinations').textContent,/203\.0\.113\.4:443/);
  await delay(5);
  assert.deepEqual(lookups,['203.0.113.4','203.0.113.5']);
  assert.match(s.$('map-graph').textContent,/example\.test/);
  assert.match(s.$('map-graph').textContent,/203\.0\.113\.4:443/);
  assert.match(s.$('map-graph').textContent,/203\.0\.113\.5:443/);
  assert.match(s.$('map-destinations').textContent,/example\.test/);
  s.$('map-destinations').querySelector('button[aria-label="Diagnose 203.0.113.4:443"]').click();
  await delay(5);
  assert.equal(s.$('map-probe-result').hidden,false);
  assert.equal(s.$('diagnostics').hidden,false);
  assert.equal(s.$('network-map').hidden,true);
  assert.ok(s.$('diagnostics').contains(s.$('map-probe-result')));
  assert.equal(s.$('map-probe-result').dataset.state,'connected');
  assert.equal(s.$('map-probe-status').textContent,'TCP connected');
  assert.equal(s.$('map-probe-time').textContent,'42 ms');
  assert.match(s.$('map-probe-target').textContent,/Google Chrome.*203\.0\.113\.4:443/);
  s.$('map-probe-retry').click();
  await delay(5);
  assert.equal(s.$('map-probe-time').textContent,'42 ms');
  const returnToMap=new Promise(resolve=>s.dom.window.addEventListener('hashchange',resolve,{once:true}));
  s.$('map-probe-close').click();
  await returnToMap;
  assert.equal(s.$('map-probe-result').hidden,true);
  assert.equal(s.$('network-map').hidden,false);
  const dialog=s.$('map-name-dialog');
  dialog.showModal=()=>{dialog.open=true;};
  dialog.close=()=>{dialog.open=false;};
  const destination=()=>s.$('map-graph').querySelector('[data-destination-address="203.0.113.4"]');
  destination().dispatchEvent(new s.dom.window.MouseEvent('click',{bubbles:true}));
  assert.equal(dialog.open,true);
  s.$('map-custom-name').value='Office printer';
  s.$('map-name-form').dispatchEvent(new s.dom.window.Event('submit',{cancelable:true}));
  assert.match(destination().textContent,/Office printer/);
  assert.equal(new Map(JSON.parse(s.dom.window.localStorage.getItem('netdoctor.destination-names'))).get('203.0.113.4'),'Office printer');
  destination().dispatchEvent(new s.dom.window.MouseEvent('click',{bubbles:true}));
  assert.equal(s.$('map-custom-name').value,'Office printer');
  s.$('map-name-remove').click();
  assert.match(destination().textContent,/example\.test/);
  assert.equal(lookups.length,2);
  const filter=s.$('map-destination-filter');
  filter.value='missing.test';
  filter.dispatchEvent(new s.dom.window.Event('input'));
  assert.match(s.$('map-destinations').textContent,/No destinations match/);
  filter.value='example.test';
  filter.dispatchEvent(new s.dom.window.Event('input'));
  assert.match(s.$('map-destinations').textContent,/203\.0\.113\.4:443/);
  assert.equal(s.$('map-graph').querySelectorAll('[data-app]').length,2);
  s.$('map-measure').click();
  await delay(10);
  assert.equal(requests.at(-1),'chrome');
  assert.match(s.$('map-traffic-status').textContent,/Taking the first two TCP samples/);
  assert.equal(s.$('map-metrics').hidden,false);
  assert.equal(s.$('map-rx').textContent,'—');
  await delay(800);
  assert.equal(s.$('map-rx').textContent,'8 Mbps');
  assert.equal(s.$('map-tx').textContent,'2 Mbps');
  assert.equal(s.$('map-covered').textContent,'1 of 2');
  assert.match(s.$('map-graph').textContent,/RX 12 packets/);
  assert.match(s.$('map-graph').textContent,/TX 8 packets/);
  assert.match(s.$('map-destinations').textContent,/31 in \/ 12 out/);
  assert.match(s.$('map-destinations').textContent,/example\.test/);
  s.$('map-graph').querySelector('[data-app="firefox"]').dispatchEvent(new s.dom.window.MouseEvent('click',{bubbles:true}));
  await delay(10);
  assert.equal(requests.at(-1),'firefox');
  assert.equal(filter.value,'');
  assert.equal(s.$('map-rx').textContent,'—');
  await navigate('.map-back');
  assert.equal(s.$('normal-workspace').hidden,false);
  assert.equal(s.$('network-map').hidden,true);
 }finally{s.dom.window.close()}
});

test('network map accounts for hidden destinations and offers Gemini after a map diagnostic',async()=>{
 const calls=[];
 const destinations=[4,4,3,...Array(18).fill(3),2].map((count,index)=>({
  count, address:'203.0.113.'+(index+1), port:443, measured:0
 }));
 let report;
 const s=session(async mode=>{
  calls.push(mode);
  report=s.dom.window.ND.makeDemo('healthy','wifi');
  report.mode='live';report.scenario=null;report.provenance.source='python-host';
  return report;
 },async()=>({state:'connected',id:'wifi',name:'Wi-Fi',medium:'Wi-Fi',address:'192.0.2.20',
  gateways:['192.0.2.1'],sampledAt:1000,received:0,sent:0,
  map:{state:'off',apps:[{name:'chrome',count:67,measured:0,destinations}]} }),
 undefined,async id=>{
  assert.equal(id,report.id);
  return {evidence_ids:[report.measurements[0].id],next_action:0};
 });
 try{
  const changed=new Promise(resolve=>s.dom.window.addEventListener('hashchange',resolve,{once:true}));
  s.dom.window.location.hash='network-map';
  await changed;
  await delay(5);
  const other=s.$('map-graph').querySelector('.topology-other');
  assert.match(other.textContent,/Other destinations/);
  assert.match(other.textContent,/56 TCP connections/);
  assert.match(s.$('map-ai-context').textContent,/67 TCP connections across 22 destinations/);
  s.$('demo').click();
  s.$('map-diagnose').click();
  await delay(5);
  assert.deepEqual(calls,['live']);
  s.$('map-ai').querySelector('button').click();
  await delay(5);
  assert.match(s.$('map-ai').textContent,/Suggested next step/);
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
