'use strict';
const $=id=>document.getElementById(id);
const app=window.netdoctor;
const ND=window.ND;
let clearPending=false;
let mode='live',history=[],current=null,prior=null,running=false,toastTimer;
let routeVersion=0;
const themeKey='netdoctor.desktop.theme';
const themeButton=$('theme-toggle');
function applyTheme(theme){
 document.documentElement.dataset.theme=theme;
 themeButton.textContent=theme==='dark'?'Light theme':'Dark theme';
 themeButton.setAttribute('aria-label',theme==='dark'?'Switch to light theme':'Switch to dark theme');
}
let storedTheme;
try{storedTheme=localStorage.getItem(themeKey)}catch{}
applyTheme(storedTheme==='light'?'light':'dark');
themeButton.addEventListener('click',()=>{
 const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
 applyTheme(next);
 try{localStorage.setItem(themeKey,next)}catch{}
});
const key='netdoctor.desktop.history.v1';
try{const stored=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(stored))history=stored.slice(0,15).flatMap(r=>{try{return[ND.normalize(r)]}catch{return[]}})}catch{}
function el(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node}
function note(msg){clearTimeout(toastTimer);$('status').textContent=msg;toastTimer=setTimeout(()=>$('status').textContent='',8500)}
function historyUI(){
 const keep=$('keep-history');const prompt=$('clear-prompt');keep.hidden=!clearPending;prompt.hidden=!clearPending;$('clear').textContent=clearPending?'Clear reports':'Clear';
 const target=$('history');target.replaceChildren();$('clear').disabled=!history.length||running;
 if(!history.length){target.append(el('p','No runs yet.','help'));return}
 const list=el('ul',null,'history-list');
 history.slice(0,7).forEach(r=>{const row=el('li'),button=el('button',null);button.type='button';button.disabled=running;button.append(el('span',r.diagnosis.title),el('small',({fixture:'OFFLINE', 'controlled-loopback':'LAB','python-host':'LIVE'})[ND.source(r)]));button.addEventListener('click',()=>{current=r;prior=null;mapSignal(r);render()});row.append(button);list.append(row)});
 target.append(list);
}
function persist(){try{localStorage.setItem(key,JSON.stringify(history))}catch{note('This session could not write local history. Export your report before closing.')}}
function setMode(next){
 mode=next;
 for(const id of ['lab','demo','live'])$(id).setAttribute('aria-pressed',String(next===id));
 $('scenario-wrap').hidden=next==='live';
 $('scenario-label').textContent=next==='lab'?'Controlled lab fault':'Offline example';
 const choices=next==='lab'?ND.labScenarios:ND.scenarios;
 const previous=$('scenario').value;
 $('scenario').replaceChildren();
 for(const c of choices){const o=el('option',c.title);o.value=c.id;$('scenario').append(o)}
 if(choices.some(c=>c.id===previous))$('scenario').value=previous;
 updateHint();
 $('adapter-details').hidden=next!=='live';
 $('auto-access').hidden=next!=='live';
 if(next!=='live' && $('access').value==='auto')$('access').value='unknown';
 if(next==='live')$('access').value='auto';
 $('mode-hint').textContent=({demo:'Uses example data.',lab:'Measures a controlled fault on this PC’s loopback interface.',live:'Checks the local gateway, DNS and HTTPS reachability.'})[next];
 $('run-label').textContent=({demo:'Run offline example',lab:'Run lab fault',live:'Run live diagnostic'})[next];
}
const navLinks=[...document.querySelectorAll('.dashboard-nav a')];
function updateNavigation(){
 const active=navLinks.find(link=>link.hash===location.hash)||navLinks[0];
 for(const link of navLinks){
  if(link===active)link.setAttribute('aria-current','location');
  else link.removeAttribute('aria-current');
 }
 const judgeOpen=!$('judge-board').hidden;
 const mapOpen=!judgeOpen&&location.hash==='#network-map';
 const diagnosticsOpen=!judgeOpen&&location.hash==='#diagnostics';
 const wasOnMap=!$('network-map').hidden;
 const wasOnDiagnostics=!$('diagnostics').hidden;
 $('network-map').hidden=!mapOpen;
 $('diagnostics').hidden=!diagnosticsOpen;
 $('normal-workspace').hidden=judgeOpen||mapOpen||diagnosticsOpen;
 for(const [slot,id] of [['setup','diagnostic-setup'],['report','result']]){
  const destination=$((diagnosticsOpen?'diagnostics-':'dashboard-')+slot);
  if($(id).parentElement!==destination)destination.append($(id));
 }
 networkMap.open(mapOpen);
 if(mapOpen&&!wasOnMap){
  $('map-title').focus();
 }else if(diagnosticsOpen&&!wasOnDiagnostics){
  networkMap.focusDiagnostic()||$('diagnostics-title').focus();
 }else if((wasOnMap||wasOnDiagnostics)&&!mapOpen&&!diagnosticsOpen&&!judgeOpen){
  $(active.hash.slice(1))?.scrollIntoView?.();
 }
}
window.addEventListener('hashchange',updateNavigation);
function render(){
 for(const [label,value] of window.NetDoctorNetwork.checkMetrics(current)){
  $('diag-'+label).textContent=current&&ND.source(current)==='python-host'?value:'—';
 }
 $('diagnostics-scope').textContent=current
  ? ND.source(current)==='python-host'
   ? 'Gateway, DNS, and HTTPS results from the selected live report. DNS and HTTPS use the named test hosts below.'
   : 'The selected report uses '+(ND.source(current)==='fixture'?'offline example data.':'a controlled lab.')+' Live gateway, DNS, and HTTPS results require a live check.'
  : 'Run or select a live report for gateway, DNS, and HTTPS results.';
 if(current)window.NetDoctorResultView.renderReport($('result'),current,prior,running,{retest:run,save,explain:app?.explain});
}
function mapSignal(report,busyNow=false){
 const path=$('signal-path'), map=report?new Map(report.measurements.map(m=>[m.id,m])):new Map();
 function status(ids){
  const values=ids.map(id=>map.get(id)?.status).filter(Boolean);
  if(values.includes('fail'))return ['fail','Check failed'];
  if(values.includes('warn')||values.includes('warning'))return ['warn','Needs review'];
  if(!values.length||values.every(s=>s==='unknown'))return ['unknown','Not measured'];
  if(values.includes('unknown'))return ['unknown','Partial evidence'];
  return ['pass','Check passed'];
 }
 for(const [stage,info] of Object.entries({
  device:report?['pass','Run recorded']:['unknown','No run yet'],
  gateway:status(['gateway','latency']),
  dns:status(['dns','dns_1','dns_2']),
  path:status(['https_1','https_2','loss','loaded'])
 })){
  const node=path.querySelector('[data-stage="'+stage+'"]');
  node.dataset.state=info[0];node.querySelector('small').textContent=info[1];
 }
 path.toggleAttribute('data-busy',busyNow);
 $('signal-caption').textContent=busyNow?'Check running. No new verdict yet.':report?ND.typeLabel(report):'Results appear after a run.';
}
function busy(value){running=value;$('result').setAttribute('aria-busy',String(value));mapSignal(current,value);for(const id of ['run','lab','demo','live','access','scenario'])$(id).disabled=value;$('map-diagnose').disabled=value||!app?.diagnose;historyUI();if(current)render();}
async function run(retest=null,overrideScenario=null,fromMap=false){
 if(running)return;
 const selected=fromMap?'live':retest?({'fixture':'demo','controlled-loopback':'lab','python-host':'live'})[ND.source(retest)]:mode;
 const sc=overrideScenario??retest?.scenario??$('scenario').value;
 if(selected!=='demo'&&!app){note('Use the Electron desktop app to run live or lab measurements.');return}
 clearPending=false; $('view-report').hidden=true; $('run-feedback').dataset.state='busy'; $('run-feedback').textContent='Checking. The report will update when the run finishes.';
 busy(true); note('');
 if(fromMap){
  $('map-ai').replaceChildren();
  $('map-ai-status').textContent='Running the live diagnostic…';
 }
 try{
  const medium=selected==='live'?await networkView.refresh():null;
  const measuredRoute=routeVersion;
  const access=selected==='live'&&(fromMap||mode!=='live'||$('access').value==='auto')
   ? ({'Wi-Fi':'wifi',Ethernet:'ethernet'})[medium]||'unknown'
   : retest?.access??$('access').value;
  const reported=selected==='demo'?ND.makeDemo(sc,access):await app.diagnose(selected,access,sc);
  if(selected==='live'&&reported?.provenance?.source!=='python-host')throw Error('The service returned the wrong measurement mode.');
  const data=ND.normalize(reported);
  if(ND.source(data)!==({'demo':'fixture','lab':'controlled-loopback','live':'python-host'})[selected])throw Error('The service returned the wrong measurement mode.');
  if(selected==='live'&&measuredRoute===routeVersion)networkView.showChecks(data);
  else if(fromMap)$('map-ai-status').textContent='The network changed during the check. Run it again for the current connection.';
  current=data;prior=retest;$('run-feedback').textContent='Check complete.';$('run-feedback').dataset.state='done';$('view-report').hidden=false;history=[data,...history].slice(0,15);persist();
 }catch(e){$('run-feedback').textContent='Check not completed. Retry or choose an offline example.';$('run-feedback').dataset.state='error';const reason=e?.message?.replace(/^Error invoking remote method '[^']+': (Error: )?/,'')||'Could not complete the test.';if(fromMap)$('map-ai-status').textContent=reason;note(reason)}finally{busy(false);
  const heading=$('result-title');if($('run-feedback').dataset.state==='done'&&heading){
   $('result').removeAttribute('data-fresh');
   (window.requestAnimationFrame??(callback=>setTimeout(callback,0)))(()=>$('result')?.setAttribute('data-fresh',''));
   if(document.activeElement===document.body)heading.focus({preventScroll:true});
  }
 }
}
async function save(format,r){
 try{
  if(app){const ok=await app.save(format,r);if(ok)note('Redacted report saved.');return}
  note('Open the Electron application to save files.');
 }catch{note('Could not save the report.')}
}
function updateHint(){
 $('scenario-hint').textContent=(mode==='lab'?ND.labScenarios:ND.scenarios).find(x=>x.id===$('scenario').value)?.description||'';
}
$('scenario').addEventListener('change',updateHint);
$('lab').addEventListener('click',()=>setMode('lab'));
$('demo').addEventListener('click',()=>setMode('demo'));
$('live').addEventListener('click',()=>setMode('live'));
$('run').addEventListener('click',()=>run());
$('view-report').addEventListener('click',event=>{
 if(location.hash==='#diagnostics'){event.preventDefault();$('result-title').focus();}
});
$('map-diagnose').disabled=!app?.diagnose;
$('map-diagnose').addEventListener('click',()=>run(null,null,true));
$('keep-history').addEventListener('click',()=>{clearPending=false;historyUI();$('clear').focus()});
$('clear').addEventListener('click',()=>{if(!clearPending){clearPending=true;historyUI();return} clearPending=false;history=[];current=null;prior=null;persist();historyUI();mapSignal(null);networkView.showChecks(null);render();$('view-report').hidden=true;$('run-feedback').textContent='';const n=el('div',null,'empty');const h=el('h2','Your diagnosis will appear here');h.id='result-title';n.append(h,el('p','Choose a connection test to start again.'));$('result').replaceChildren(n);note('Local run history cleared.');$('run').focus()});
let heldResult=[];
const judge=window.NetDoctorJudge.mount($('judge-board'),{
 app, element:el, save,
 commit:r=>{history=[r,...history].slice(0,15);persist();},
});
$('judge-toggle').addEventListener('click',()=>{
 if(running||judge.busy())return;
 const opening=$('judge-board').hidden;
 $('judge-board').hidden=!opening;
 updateNavigation();
 document.querySelector('.dashboard-nav').hidden=opening;
 $('judge-toggle').setAttribute('aria-pressed',String(opening));
 $('judge-toggle').textContent=opening?'Exit judge mode':'Pick a Fault';
 note('');
 if(opening){heldResult=[...$('result').childNodes];$('result').replaceChildren();$('history').replaceChildren();judge.open();}
 else{judge.close();$('result').replaceChildren(...heldResult);heldResult=[];historyUI();if(current)render();}
});
const networkMap=window.NetDoctorMap.mount({element:el,refresh:()=>networkView.refresh(),lookupDomain:app?.reverseDns,checkDestination:app?.checkDestination});
const networkView=window.NetDoctorNetwork.mount({
 read:app?.network,measurementApp:networkMap.measurementApp,
 element:el,onRouteChange:()=>{routeVersion++;},onSample:(sample,traffic)=>{
  networkMap.apply(sample,traffic);
  for(const side of ['rx','tx']){
   const value=window.NetDoctorNetwork.rate(traffic?.[side]);
   const node=$('diag-'+side);
   if(node.textContent!==value)node.textContent=value;
  }
 },
 onChecks:report=>{
  for(const id of ['dashboard-ai','map-ai']){
   const assist=window.NetDoctorResultView.buildEvidenceAssist(report,app?.explain,false,true);
   $(id).replaceChildren(...(assist?[assist]:[]));
  }
  $('map-ai-status').textContent=report
   ? (app?.explain?'':'Gemini guidance is available in the desktop app.')
   : 'Run a live diagnostic to ask Gemini what to try next.';
 }
});
updateNavigation();
setMode('live');historyUI();
if(app)app.connect().then(ok=>{$('connection').textContent=ok?'Local Python ready':'Offline demos ready'}).catch(()=>{$('connection').textContent='Offline demos ready'});
