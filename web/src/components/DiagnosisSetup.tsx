import type { Access, Mode, Scenario } from '../diagnostics';
import { Icon } from './Icon';

type Props = {
  mode: Mode; access: Access; scenario: string; choices: Scenario[];
  busy: boolean; collectorReady: boolean;
  onMode: (mode: Mode) => void; onAccess: (access: Access) => void;
  onScenario: (id: string) => void; onRun: () => void; onCancel: () => void; onBlind: () => void;
};
export function DiagnosisSetup({mode,access,scenario,choices:available,busy,collectorReady,onMode,onAccess,onScenario,onRun,onCancel,onBlind}:Props) {
 const selected=available.find(item=>item.id===scenario);
 return <section className="panel setup" aria-labelledby="setup" aria-busy={busy}>
      <div className="section-heading"><span className="square"><Icon name="pulse" size={19}/></span><div><h2 id="setup">Run a diagnosis</h2><p>Start with your connection or explore a controlled case.</p></div></div>
      <fieldset className="mode" disabled={busy}><legend className="sr-only">Run mode</legend>
       <button type="button" aria-pressed={mode==='demo'} onClick={()=>onMode('demo')}><Icon name="lab" size={17}/> Controlled demo</button>
       <button type="button" aria-pressed={mode==='live'} onClick={()=>onMode('live')}><Icon name="pulse" size={17}/> Live collector</button>
      </fieldset>
      <div className="fields">
       {mode==='demo'&&<label>Scenario<select value={scenario} disabled={busy} onChange={e=>onScenario(e.target.value)}>{available.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
       <label>Access type<select value={access} disabled={busy} onChange={e=>onAccess(e.target.value as Access)}><option value="unknown">Not sure</option><option value="wifi">Wi-Fi</option><option value="ethernet">Ethernet</option></select></label>
      </div>
      <p className="field-note"><Icon name="info" size={15}/>{mode==='demo'?(selected?.description??'Uses known, controlled sample data.'):collectorReady?'Measures from the computer running the Python collector, not necessarily this browser device. Only use it on a network you’re authorized to measure.':'Start the local Python collector and recheck its status before running a live test.'}</p>
      <div className="actions-row"><button type="button" className="button primary" disabled={busy||mode==='live'&&!collectorReady} onClick={onRun}>{busy?<span className="spinner"/>:<Icon name={mode==='demo'?'lab':'pulse'} size={17}/>} {busy?'Measuring.':mode==='demo'?'Run demo':'Run live test'}{!busy&&<Icon name="arrow" size={17}/>}</button>
       {mode==='demo'&&!busy&&<button type="button" className="button secondary" disabled={!collectorReady} onClick={onBlind} title="Uses measured loopback cases only"><Icon name="lab" size={16}/> Pick a fault</button>}
       {busy&&<button className="button secondary" onClick={onCancel}>Cancel</button>}
      </div>
      <p className="check-feedback" role="status">{busy?'Collecting evidence. The verdict will update after the check.':mode==='demo'&&collectorReady?'Pick a fault measures a hidden lab condition. Revealing it saves the run.':''}</p>
     </section>;
}

