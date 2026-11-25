import type { RefObject } from 'react';
import { accessLabel, compareMeasurements, confidenceLabel, observationTone, type Report } from '../diagnostics';
import { Icon } from './Icon';
import { GeminiEvidence } from './GeminiEvidence';
import { displayDate, displayTime } from './formatTime';

type Props = {
  result: Report; previous: Report | null; resultHeading: RefObject<HTMLHeadingElement | null>;
  busy: boolean; collectorReady: boolean; geminiEnabled: boolean; firebaseConfigured: boolean; cloudBusy: boolean; cloudNote: string;
  challengeLabel?: string; blindHidden: boolean; onReveal: () => void;
  onRetest: () => void; onClean: () => void; onExport: () => void; onSupport: () => void; onCloud: () => void;
};
export function EvidenceReport({result,previous,resultHeading,busy,collectorReady,geminiEnabled,firebaseConfigured,cloudBusy,cloudNote,challengeLabel,blindHidden,onReveal,onRetest,onClean,onExport,onSupport,onCloud}: Props) {
 const deltas=previous?compareMeasurements(previous,result):[];
 const clean=Boolean(previous?.source==='controlled-loopback'&&result.source==='controlled-loopback'&&result.scenario==='control'&&previous.scenario!=='control');
 const first=clean&&previous?previous:result;
 return <section className="results" aria-labelledby="result-title">
   <header className="result-meta"><span className={result.mode==='demo'?'tag is-demo':'tag is-live'}><Icon size={14} name={result.mode==='demo'?'lab':'pulse'}/>{result.source==='controlled-loopback'?'Controlled loopback · measured locally':result.mode==='demo'?'Controlled example · not measured':'Live collector measurement'}</span><time dateTime={result.created_at}>{displayDate(result.created_at)}</time></header>
   <div className="panel conclusion">
    <div className="conclusion-main"><p className="module-index">VERDICT {clean?' · CLEAN CONTROL':''}</p><h2 tabIndex={-1} ref={resultHeading} id="result-title">{result.diagnosis.title}</h2><p>{result.diagnosis.summary}</p><div className="metadata"><span>{confidenceLabel(result.diagnosis.confidence)}</span><span>{accessLabel[result.access]}</span></div></div>
    <div className="result-tools no-print">{blindHidden?<button className="button primary" onClick={onReveal}>Reveal injected condition</button>:<>
     <button className="button primary" disabled={busy||result.source!=='offline-fixture'&&!collectorReady} onClick={onRetest}><Icon name="refresh" size={16}/> Retest</button>
     {result.source==='controlled-loopback'&&result.scenario!=='control'&&<button className="button secondary" disabled={busy||!collectorReady} onClick={onClean}>Retest without fault</button>}
     <button className="button secondary" onClick={onSupport}><Icon name="download" size={16}/> Support note</button>
     <button className="button secondary" onClick={onExport}><Icon name="download" size={16}/> JSON</button>
     <button className="button secondary" onClick={()=>window.print()}><Icon name="printer" size={16}/> Print / PDF</button>
    </>}</div>
   </div>
   {(blindHidden||challengeLabel)&&<section className="panel detail"><h3><Icon name="lab" size={17}/> Blind lab challenge</h3><p role="status">{blindHidden?'The injected condition is hidden. Review the verdict and deciding evidence before revealing the lab setup.':'Injected lab condition: '+challengeLabel+'.'}</p></section>}
   <section className="panel detail"><h3><Icon name="link" size={17}/> Evidence behind the result</h3>{clean&&<p>Deciding evidence from the run with the injected fault:</p>}{first.evidence.length?<ul>{first.evidence.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>No deciding observation was available.</p>}</section>
   {previous&&<section className="panel comparison" aria-label="Retest comparison"><div><h3>Before and after</h3><p>{clean?'Lab fault removed for this comparison. This is not a home network recovery.':previous.source==='controlled-loopback'&&result.source==='controlled-loopback'?'Both runs were measured in a controlled loopback lab.':previous.mode==='demo'?'Both runs use controlled scenarios, not household measurements.':'Both runs were measured by the live collector.'}</p></div>
    <div><span>Before</span><strong>{previous.diagnosis.title}</strong><small>{displayTime(previous.created_at)}</small></div><div><span>Latest</span><strong>{result.diagnosis.title}</strong><small>{displayTime(result.created_at)}</small></div>
    {deltas.length>0&&<ul className="deltas">{deltas.map(d=><li key={d.id}><strong>{d.label}</strong><span>{d.before} → {d.after} {d.unit}</span></li>)}</ul>}
   </section>}
   {!blindHidden&&<section className="panel detail"><h3><Icon name="check" size={17}/> Safe next step</h3>{first.actions.length?<ol>{first.actions.map((x,i)=><li key={i}>{x}</li>)}</ol>:<p>Repeat the check and compare a second device before assigning a cause.</p>}</section>}
   <section className="panel observations"><h3>What was observed</h3>{result.measurements.length? <ul>{result.measurements.map((row,i)=><li key={row.id+'-'+i}><span className={'result-state '+observationTone(row.status)}/><div><strong>{row.label}</strong>{row.detail&&<small>{row.detail}</small>}</div><b>{row.value===null?'Unavailable':typeof row.value==='boolean'?(row.value?'Yes':'No'):String(row.value)}{row.value!==null&&row.unit?' '+row.unit:''}</b></li>)}</ul>:<p>No usable measurements were returned.</p>}</section>
   <section className="panel detail"><h3><Icon name="info" size={17}/> Scope and limitations</h3><ul>{result.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul></section>
   {!blindHidden&&(result.source==='controlled-loopback'||result.mode==='live')&&<GeminiEvidence key={result.id} report={result} enabled={geminiEnabled&&collectorReady}/>}
   {!blindHidden&&firebaseConfigured&&<section className="panel settings no-print"><div><h3>Private cloud copy</h3><p>Copies this report to your configured Firebase project. Nothing is uploaded automatically.</p></div><button className="button secondary" disabled={cloudBusy} onClick={onCloud}>{cloudBusy?'Saving…':'Save cloud copy'}</button>{cloudNote&&<p role="status">{cloudNote}</p>}</section>}
 </section>;
}


