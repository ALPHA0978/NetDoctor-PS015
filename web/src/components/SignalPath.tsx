import {Icon} from './Icon';
import type {Report} from '../diagnostics';
type State='ready'|'warn'|'bad'|'unknown';
const stages=[
 {key:'gateway',icon:'router',label:'Gateway',ids:['gateway','latency']},
 {key:'dns',icon:'globe',label:'DNS',ids:['dns','dns_1','dns_2']},
 {key:'path',icon:'pulse',label:'Network path',ids:['https_1','https_2','loss','loaded']},
] as const;
const captions:Record<State,string>={ready:'Check passed',warn:'Needs review',bad:'Check failed',unknown:'Not measured'};
export function SignalPath({report,busy}:{report:Report|null;busy:boolean}){
 const data=new Map(report?.measurements.map(m=>[m.id,m.status])??[]);
 return <section className="panel trace" aria-labelledby="trace" aria-busy={busy}>
  <h2 id="trace">Connection checks</h2>
  <p>{busy?'Check running. No new verdict yet.':!report?'Results will appear here when a check finishes.':report.source==='controlled-loopback'?'Measured in the isolated lab.':report.mode==='demo'?'Offline example, not a live measurement.':'Readings from the computer running the collector.'}</p>
  <ol>{stages.map(({key,icon,label,ids})=>{
   const values=ids.map(id=>data.get(id)).filter(Boolean);
   const tone:State=values.includes('fail')?'bad':values.includes('warn')||values.includes('warning')?'warn':values.length&&!values.includes('unknown')&&values.every(state=>state==='pass')?'ready':'unknown';
   return <li key={key} data-signal={tone}><span className="path-icon"><Icon name={icon} size={17}/></span><div><strong>{label}</strong><small>{captions[tone]}</small></div></li>;
  })}</ol>
 </section>;
}
