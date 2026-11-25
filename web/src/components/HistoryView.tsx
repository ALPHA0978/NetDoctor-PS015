import { useState } from 'react';
import type { Report } from '../diagnostics';
import { Icon } from './Icon';
import { displayTime } from './formatTime';
type Props={history: Report[]; onOpen: (item: Report) => void; onDiagnose: () => void; onClear: () => void};
export function HistoryView({history,onOpen,onDiagnose,onClear}:Props) {
 const [clearing,setClearing]=useState(false);
 return <div className="content no-print"><header className="page-title"><span className="module-index">02 / SAVED RUNS</span><h1>History</h1><p>Review the latest 16 reports stored in this browser.</p></header>
    <section className="panel records" aria-label="Saved reports">{history.length?history.map(item=><button key={item.id} className="history-row" onClick={()=>onOpen(item)}><span className="square"><Icon name={item.mode==='demo'?'lab':'pulse'} size={18}/></span><span><strong>{item.diagnosis.title}</strong><small>{item.source==='controlled-loopback'?'Controlled loopback':item.mode==='demo'?'Controlled example':'Live collector'} · {displayTime(item.created_at)}</small></span><Icon name="chevron" size={16}/></button>):<div className="empty"><span className="square"><Icon name="clock" size={24}/></span><div><h3>Nothing saved yet</h3><p>Completed runs will appear here.</p></div><button className="button secondary" onClick={onDiagnose}>Open Diagnose</button></div>}</section>
    {history.length>0&&<div className="clear-block">{!clearing?<button className="button secondary" onClick={()=>setClearing(true)}><Icon name="remove" size={15}/> Clear local history</button>:<><strong>Remove all reports from this browser?</strong><button className="button danger" onClick={onClear}>Clear reports</button><button className="button secondary" onClick={()=>setClearing(false)}>Keep reports</button></>}</div>}
   </div>;
}
