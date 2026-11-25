'use client';
import {useEffect,useRef,useState} from 'react';
import {newFixture,output,parseReport,readAPI,readHistory,readScenarios,scenarios,updateHistory,type Access,type Mode,type Report,type Scenario} from './diagnostics';
import {firebaseConfigured,savePrivateReport} from './firebase';
import {faultTitle,matchesChallenge,pickFault,supportNote,type FaultId} from './challenge';
import { Icon } from './components/Icon';
import { SignalPath } from './components/SignalPath';
import { DiagnosisSetup } from './components/DiagnosisSetup';
import { EvidenceReport } from './components/EvidenceReport';
import { HistoryView } from './components/HistoryView';
import { PrivacyView } from './components/PrivacyView';
import { ThemeSwitch } from './components/ThemeSwitch';

const historyKey='netdoctor-history-v1';
type Connection='checking'|'ready'|'offline';
export default function Dashboard(){
 const [geminiEnabled,setGeminiEnabled]=useState(false);
 const [conn,setConn]=useState<Connection>('checking');
 const [mode,setMode]=useState<Mode>('demo');
 const [access,setAccess]=useState<Access>('unknown');
 const [scenario,setScenario]=useState('gateway');
 const [available,setAvailable]=useState<Scenario[]>(scenarios);
 const [result,setResult]=useState<Report|null>(null);
 const [challenge,setChallenge]=useState<{fault:FaultId;revealed:boolean}|null>(null);
 const [previous,setPrevious]=useState<Report|null>(null);
 const [history,setHistory]=useState<Report[]>([]);
 const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');
 const [note,setNote]=useState('');
 const [tab,setTab]=useState<'overview'|'history'|'privacy'>('overview');
 const [cloudBusy,setCloudBusy]=useState(false);
 const [cloudNote,setCloudNote]=useState('');
 const run=useRef<AbortController|null>(null);
 const resultHeading=useRef<HTMLHeadingElement|null>(null);
 const focusResult=useRef(false);
 useEffect(()=>{try{setHistory(readHistory(localStorage.getItem(historyKey)));}catch{/* browser persistence may be blocked */}setReady(true); return ()=>run.current?.abort();},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(historyKey,JSON.stringify(history));}catch{/* in-memory history remains */}},[history,ready]);
 useEffect(()=>{if(result&&tab==='overview'&&focusResult.current){focusResult.current=false; resultHeading.current?.focus();}},[result,tab]);
 async function connect(signal?:AbortSignal){
  setConn('checking');
  try{
   const status=await readAPI('/health',{signal:signal??AbortSignal.timeout(2600)}) as {gemini_enabled?:boolean};
   if(signal?.aborted)return;
   setGeminiEnabled(status.gemini_enabled===true);
   const rows=readScenarios(await readAPI('/scenarios',{signal:signal??AbortSignal.timeout(2600)}));
   if(signal?.aborted)return;
   setAvailable(rows.length?rows:scenarios);setScenario(s=>rows.some(x=>x.id===s)?s:(rows[0]?.id??'gateway'));
   setConn('ready');
  } catch {if(!signal?.aborted){setGeminiEnabled(false);setConn('offline');setAvailable(scenarios);setScenario(s=>scenarios.some(x=>x.id===s)?s:'gateway');}}
 }
 useEffect(()=>{const c=new AbortController();void connect(c.signal);return ()=>c.abort();},[]);
 async function diagnose(retest?:Report, overrideScenario?:string, blindFault?:FaultId){
  if(run.current)return;
  const testMode=blindFault?'demo':retest?.mode??mode,testAccess=retest?.access??access,testScenario=blindFault??overrideScenario??retest?.scenario??scenario;
  if(blindFault&&conn!=='ready')return;
  const c=new AbortController();run.current=c;setBusy(true);setError('');setNote('');setCloudNote('');setTab('overview');
  try {
   let report:Report;
   if(!blindFault&&testMode==='demo'&&((!retest&&conn!=='ready')||retest?.source==='offline-fixture')){
    report=newFixture(testScenario,testAccess);
   }else{
    const raw=await readAPI('/diagnose',{method:'POST',signal:c.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:testMode,access:testAccess,...(testMode==='demo'?{scenario:testScenario}:{})})});
    report=parseReport(raw,testMode);
   }
   if(c.signal.aborted)return;
   if(blindFault&&!matchesChallenge(report,blindFault))throw new Error('The collector did not return the requested measured lab case. Nothing was saved.');
   setPrevious(retest??null);
   focusResult.current=true;
   setChallenge(blindFault?{fault:blindFault,revealed:false}:retest&&!overrideScenario?challenge:null);
   setResult(report);if(!blindFault)setHistory(items=>updateHistory(items,report));
   setNote(blindFault?'Controlled measurements ready. The injected condition is hidden.':report.mode==='demo'?(report.source==='controlled-loopback'?'Controlled loopback measurements saved locally.':'Controlled example saved locally.'):'Live collector report saved locally.');
  }catch(e){if(!c.signal.aborted)setError(testMode==='live'?'Live test could not finish. Check that the Python collector is running and allows this web origin. No demo result was substituted.':(e instanceof Error?e.message:'Unable to load this scenario.'));}
  finally{if(run.current===c){run.current=null;setBusy(false);}}
 }
 function cancel(){run.current?.abort();run.current=null;setBusy(false);setNote('Run canceled in the browser. The collector may finish its current bounded probe.');}
 function runChallenge(){
  const fault=pickFault(available);
  if(!fault){setError('No supported lab cases were returned by the collector.');return;}
  void diagnose(undefined,undefined,fault);
 }
 function revealChallenge(){
  if(!result||!challenge||challenge.revealed)return;
  setChallenge({...challenge,revealed:true});setHistory(items=>updateHistory(items,result));setNote('Injected lab condition revealed. The result is now saved locally.');resultHeading.current?.focus();
 }
 function downloadReport(report:Report,kind:'json'|'support'){
  const payload=kind==='json'?output(report):supportNote(report,previous);
  const url=URL.createObjectURL(new Blob([payload],{type:kind==='json'?'application/json':'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='netdoctor-'+report.id.slice(0,18)+(kind==='json'?'.json':'-support.txt');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function showReport(item:Report){setPrevious(null);setChallenge(null);focusResult.current=true;setResult(item);setTab('overview');setError('');setNote('Opened a saved report. No new test was run.');setCloudNote('');}
 async function saveCloud(){
  if(!result||cloudBusy)return;
  setCloudBusy(true);setCloudNote('');
  try{await savePrivateReport(result);setCloudNote('A copy was saved to your private Firebase report space.');}
  catch{setCloudNote('Could not save to Firebase. Your local report was not changed. Check that anonymous sign-in and the Firestore rules are active.');}
  finally{setCloudBusy(false);}
 }
 const net=conn==='ready'?'Collector online':conn==='checking'?'Checking collector':'Offline demo available';
 const healthTone=conn==='ready'?'good':conn==='checking'?'neutral':'warning';
 const historyCount=String(history.length).padStart(2,'0');
 return <div className="shell">
  <a className="skip-link no-print" href="#workspace">Skip to diagnostic workspace</a>
  <aside className="sidebar no-print">
   <a className="brand" href="#workspace" onClick={()=>setTab('overview')}><span className="brand-mark"><Icon name="pulse" size={21}/></span><span>NetDoctor<small>CONNECTION DIAGNOSTICS</small></span></a>
   <span className="side-label">WORKSPACE</span>
   <nav aria-label="Workspace">
    <button className={tab==='overview'?'active':''} aria-current={tab==='overview'?'page':undefined} onClick={()=>setTab('overview')}><Icon name="grid" size={17}/> Diagnose</button>
    <button className={tab==='history'?'active':''} aria-current={tab==='history'?'page':undefined} onClick={()=>setTab('history')}><Icon name="clock" size={17}/> History <span className="nav-count">{historyCount}</span></button>
    <button className={tab==='privacy'?'active':''} aria-current={tab==='privacy'?'page':undefined} onClick={()=>setTab('privacy')}><Icon name="shield" size={17}/> Privacy</button>
   </nav>
   <div className="side-footer"><div><Icon name="shield" size={17}/> Local by default</div><p>Runs stay on this device unless you choose to export or sync them.</p><span>AIORI-3 / PS-015</span></div>
  </aside>
  <main id="workspace" className="main" tabIndex={-1}>
   <header className="topbar no-print"><p>Workspace <Icon name="chevron" size={13}/> <strong>{tab==='overview'?'Diagnose':tab==='history'?'History':'Privacy'}</strong></p><div className="top-controls"><ThemeSwitch/><button onClick={()=>void connect()} disabled={conn==='checking'||busy} className={'health '+healthTone} title="Recheck local collector"><span/> {net} <Icon name="refresh" size={13}/></button></div></header>
   {tab==='overview'&&<div className="content">
    <section className="hero no-print" aria-labelledby="welcome">
     <div className="hero-copy"><h1 id="welcome">Find where your connection slows.</h1><p>Run a check, see the evidence, and know what to try next.</p></div>
    </section>
    <div className="work-grid no-print">
     <DiagnosisSetup mode={mode} access={access} scenario={scenario} choices={available}
       busy={busy} collectorReady={conn==='ready'} onMode={next=>{setMode(next);setError('')}}
       onAccess={setAccess} onScenario={setScenario} onRun={()=>void diagnose()} onCancel={cancel} onBlind={runChallenge}/>
      <SignalPath report={result} busy={busy}/>
    </div>
    {error&&<div className="notice bad no-print" role="alert"><Icon name="info" size={17}/>{error}{result?' The existing report is unchanged.':''}</div>}
    <div className="sr-only" role="status">{note}</div>
    {result?<EvidenceReport result={result} previous={previous} resultHeading={resultHeading} busy={busy}
       collectorReady={conn==='ready'} geminiEnabled={geminiEnabled} firebaseConfigured={firebaseConfigured} cloudBusy={cloudBusy} cloudNote={cloudNote}
       challengeLabel={challenge?.revealed?faultTitle(challenge.fault):undefined} blindHidden={Boolean(challenge&&!challenge.revealed)} onReveal={revealChallenge}
       onRetest={()=>void diagnose(result)} onClean={()=>void diagnose(result,'control')} onExport={()=>downloadReport(result,'json')} onSupport={()=>downloadReport(result,'support')} onCloud={()=>void saveCloud()}/>:<section className="empty no-print"><span className="square"><Icon name="clock" size={20}/></span><div><h3>{history.length?'Pick up where you left off':'No results yet'}</h3><p>{history.length?'Open a saved report or run a new test.':'Run a controlled demo first to see how NetDoctor explains a result.'}</p></div>{history.length>0&&<button className="button secondary" onClick={()=>setTab('history')}>View history <Icon name="arrow" size={15}/></button>}</section>}
   </div>}
   {tab==='history'&&<HistoryView history={history} onOpen={showReport} onDiagnose={()=>setTab('overview')}
     onClear={()=>{setHistory([]);setResult(null);setPrevious(null);setChallenge(null);}}/>}
   {tab==='privacy'&&<PrivacyView firebaseConfigured={firebaseConfigured}/>}
   <footer className="footer no-print"><span>NetDoctor Workbench</span><span>AIORI-3 · PS-015</span></footer>
  </main>
 </div>;
}


