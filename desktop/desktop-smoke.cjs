const {app,dialog}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {mkdirSync}=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const packaged=process.env.NETDOCTOR_SMOKE_PACKAGED==='1';
const packagedApp=path.join(__dirname,'release','NetDoctor-win-x64','resources','app');
const dir=process.env.NETDOCTOR_SMOKE_OUTPUT||path.join(os.tmpdir(),'NetDoctorDesktopSmoke');
const profile=path.join(os.tmpdir(),'NetDoctorDesktopTestProfiles',String(process.pid));
mkdirSync(profile,{recursive:true});
app.setPath('userData',profile);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const script=(wc,s)=>wc.executeJavaScript(s);
async function waitFor(wc,condition,tries=100){
 for(let i=0;i<tries;i++){if(await script(wc,condition))return;await wait(110)}
 throw Error('Timed out: '+condition+' / '+await script(wc,'document.getElementById("status").textContent'));
}
let initialized=false;
process.env.NETDOCTOR_DESKTOP_SMOKE='1';
dialog.showSaveDialog=async (_win,options)=>({canceled:false,filePath:path.join(dir,options.defaultPath)});
app.on('browser-window-created',(_event,win)=>{
 if(initialized)return;initialized=true;
 const wc=win.webContents;
 wc.setBackgroundThrottling(false);
 wc.once('did-finish-load',()=>setImmediate(async ()=>{
  try{
   await fs.mkdir(dir,{recursive:true});
   await script(wc,'document.getElementById("theme-toggle").click()');
   assert.equal(await script(wc,'document.documentElement.dataset.theme'),'light');
   await wait(180);
   assert.equal(await script(wc,'getComputedStyle(document.body).backgroundColor'),'rgb(245, 248, 252)');
   await fs.writeFile(path.join(dir,'desktop-light-capture.png'),(await wc.capturePage()).toPNG());
   await script(wc,'document.getElementById("theme-toggle").click()');
   assert.equal(await script(wc,'document.documentElement.dataset.theme'),'dark');
   await script(wc, 'document.getElementById("demo").click(); document.getElementById("run").click()');
   await waitFor(wc, 'document.getElementById("result").innerText.includes("SYNTHETIC")');
   await script(wc,'[...document.querySelectorAll(".actions button")].find(x=>x.textContent==="Retest").click()');
   await waitFor(wc,'document.getElementById("result").innerText.includes("Matched retest comparison")');
   for (const format of ['PDF','JSON','HTML']) await script(wc,'[...document.querySelectorAll(".actions button")].find(x=>x.textContent==="Export '+format+'").click()');
   let exported=[];
   for(let i=0;i<70;i++){exported=await fs.readdir(dir);if(['.pdf','.html','.json'].every(x=>exported.some(p=>p.endsWith(x))))break;await wait(100)}
   const report=JSON.parse(await fs.readFile(path.join(dir,exported.filter(p=>p.endsWith('.json')).sort().at(-1)),'utf8'));
   assert.equal(report.provenance.source,'fixture');
   const pdf=await fs.readFile(path.join(dir,exported.filter(p=>p.endsWith('.pdf')).sort().at(-1)));
   assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
   await fs.writeFile(path.join(dir,'desktop-capture.png'),(await wc.capturePage()).toPNG());
   await script(wc, 'document.getElementById("clear").click();document.getElementById("clear").click()');
   await waitFor(wc,'document.getElementById("history").innerText.includes("No runs yet")');
   if(process.env.NETDOCTOR_SMOKE_LAB==='1'){
     for(const [scenario,expected] of [['gateway','gateway_unreachable'],['dns','dns'],['packet_loss','packet_loss'],['congestion','congestion']]){
       await script(wc,'document.getElementById("lab").click(); document.getElementById("scenario").value='+JSON.stringify(scenario)+'; document.getElementById("scenario").dispatchEvent(new Event("change")); document.getElementById("run").click()');
       await waitFor(wc,'!document.getElementById("run").disabled',140);
       const fault=await script(wc,'JSON.parse(localStorage.getItem("netdoctor.desktop.history.v1"))?.[0]');
       assert.equal(fault.scenario,scenario);
       assert.equal(fault.provenance.source,'controlled-loopback');
       assert.equal(fault.diagnosis.code,expected);
       console.log(scenario+' measured → '+fault.diagnosis.code);
     }
     await script(wc,'[...document.querySelectorAll(".actions button")].find(x=>x.textContent==="Retest without fault").click()');
     await waitFor(wc,'document.getElementById("result").innerText.includes("Before and after")',140);
     const providerButton=await script(wc,'[...document.querySelectorAll(".ai-evidence button")].some(x=>x.textContent==="Share readings and explain")');
     assert.equal(providerButton,true);
     await script(wc,'document.querySelector(".ai-evidence button").click()');
     await waitFor(wc,'document.querySelector(".ai-evidence [role=status]").innerText.includes("not configured")',50);
     const clean=await script(wc,'JSON.parse(localStorage.getItem("netdoctor.desktop.history.v1"))[0]');
     assert.equal(clean.scenario,'control');
     assert.equal(clean.diagnosis.code,'healthy');
     await wait(300);
     await fs.writeFile(path.join(dir,'desktop-lab-capture.png'),(await wc.capturePage()).toPNG());
     win.setSize(740,750);
     await wait(350);
     const fit=await script(wc,'document.documentElement.scrollWidth<=window.innerWidth');
     assert.equal(fit,true);
     await fs.writeFile(path.join(dir,'desktop-narrow-capture.png'),(await wc.capturePage()).toPNG());
     if(process.env.NETDOCTOR_SMOKE_LIVE==='1'){
       await script(wc,'document.getElementById("live").click(); document.getElementById("run").click()');
       await waitFor(wc,'!document.getElementById("run").disabled',350);
       const live=await script(wc,'JSON.parse(localStorage.getItem("netdoctor.desktop.history.v1"))?.[0]');
       assert.equal(live.provenance.source,'python-host');
       assert.equal(live.mode,'live');
       console.log('Live Windows host measurement → '+live.diagnosis.code);
     }
   }

   if(process.env.NETDOCTOR_SMOKE_JUDGE==='1'){
     win.setSize(1180,930);
     await wait(350);
     const startSize=await script(wc,'JSON.parse(localStorage.getItem("netdoctor.desktop.history.v1")||"[]").length');
     await script(wc, '(function(){let num=6; const rng=crypto.getRandomValues; crypto.getRandomValues=a=>{a[0]=--num;return a}; try{document.getElementById("judge-toggle").click();}finally{crypto.getRandomValues=rng;} document.getElementById("judge-card-5").click();})()');
     await waitFor(wc,'Boolean(document.getElementById("judge-reveal"))',150);
     const sealed=await script(wc,'document.getElementById("judge-board").innerText');
     assert.match(sealed,/CONDITION SEALED/);assert.match(sealed,/Inconclusive: no single cause isolated/i);assert.match(sealed,/SERVFAIL/i);
     assert.doesNotMatch(sealed,/Selected condition|Ambiguous evidence|Conflicting signals/i);
     assert.equal(await script(wc,'JSON.parse(localStorage.getItem("netdoctor.desktop.history.v1")||"[]").length'),startSize);
     wc.invalidate();
     await wc.capturePage(undefined,{stayHidden:true,stayAwake:true});
     await wait(650);
     await fs.writeFile(path.join(dir,'judge-before-reveal.png'),(await wc.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
     await script(wc,'document.getElementById("judge-reveal").click()');
     const result=await script(wc,'JSON.parse(localStorage.getItem("netdoctor.desktop.history.v1"))[0]');
     assert.equal(result.scenario,'ambiguous');assert.equal(result.diagnosis.code,'inconclusive');
     await script(wc,'document.getElementById("judge-retest").click()');
     await waitFor(wc,'document.getElementById("judge-board").innerText.includes("Before and after")',150);
     const after=await script(wc,'JSON.parse(localStorage.getItem("netdoctor.desktop.history.v1"))[0]');
     assert.equal(after.scenario,'control');assert.equal(after.diagnosis.code,'healthy');
     await script(wc,'[...document.querySelectorAll("#judge-board .judge-actions button")].find(x=>x.textContent==="Export result PDF").click()');
     const judgePath=path.join(dir,'NetDoctor-'+result.id+'.pdf');
     for(let i=0;i<80;i++){try{const content=await fs.readFile(judgePath);assert.equal(content.subarray(0,5).toString(),'%PDF-');break}catch(e){if(i===79)throw e;await wait(100)}}
     await script(wc,'document.getElementById("judge-board").querySelector(".judge-compare").scrollIntoView({block:"center"})');
     wc.invalidate();
     await wc.capturePage(undefined,{stayHidden:true,stayAwake:true});
     await wait(650);
     await fs.writeFile(path.join(dir,'judge-after-reveal.png'),(await wc.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
     console.log('Blind judge → ambiguous sealed → explicit reveal → inconclusive → clean healthy comparison → result PDF: PASS');
   }
   assert.equal(new URL(wc.getURL()).pathname.includes('/resources/app/'),packaged);
   console.log((packaged?'Bundled resources: ':'Source resources: ')+'Desktop renderer, history/retest, evidence PDF/HTML/JSON'+(process.env.NETDOCTOR_SMOKE_LAB==='1'?' and measured lab/run again':'')+': PASS. Artifact folder: '+dir);
   app.quit();
  }catch(e){console.error(e);app.exit(1)}
 }));
});
require(packaged?path.join(packagedApp,'main.cjs'):'./main.cjs');
