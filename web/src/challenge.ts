import { compareMeasurements, type Report, type Scenario } from './diagnostics.ts';

const faults = { gateway:'Gateway unreachable', dns:'DNS response failure', packet_loss:'Induced packet loss', congestion:'Induced congestion', ambiguous:'Conflicting / insufficient evidence' } as const;
export type FaultId = keyof typeof faults;
export function faultTitle(id:FaultId) { return faults[id]; }
export function pickFault(choices:Scenario[], draw=()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32):FaultId|null {
 const active=new Set(choices.map(x=>x.id));const ids=(Object.keys(faults) as FaultId[]).filter(id=>active.has(id));
 if(!ids.length)return null;
 const value=draw();if(!Number.isFinite(value)||value<0||value>=1)throw new Error('Random draw out of range.');
 return ids[Math.floor(value*ids.length)];
}
export function matchesChallenge(result:Report,id:FaultId){
 return result.mode==='demo'&&result.source==='controlled-loopback'&&result.scenario===id;
}
export function supportNote(report:Report,previous:Report|null){
 const first=previous??report;
 const scope=first.source==='controlled-loopback'?'Controlled lab only. This does not establish a home or provider fault.':first.mode==='demo'?'Illustrative fixture. No household network was measured.':'Measured on the collector host, not necessarily this browser. These observations do not establish a provider-side cause.';
 const differences=previous?compareMeasurements(previous,report):[];
 const safeStep=first.actions[0]??'Repeat the check and compare a second device before assigning a cause.';
 const lines=['NETDOCTOR SUPPORT NOTE',scope,'','INITIAL VERDICT',first.diagnosis.title,first.created_at,'','DECIDING EVIDENCE',...(first.evidence.length?first.evidence.slice(0,3).map(x=>'- '+x):['- No deciding evidence was available.']),'','RETEST'];
 if(previous){lines.push(report.diagnosis.title+' ('+report.created_at+')');if(report.source==='controlled-loopback'&&report.scenario==='control'&&previous.scenario!=='control')lines.push('Fault removed in the lab; this is not a household recovery.');
 for(const row of differences.slice(0,6))lines.push('- '+row.label+': '+row.before+' to '+row.after+(row.unit?' '+row.unit:''));
 }else lines.push('No retest recorded yet.');
 lines.push('','SAFE NEXT STEP',safeStep,'','SCOPE AND LIMITATIONS',...first.limitations.slice(0,4).map(x=>'- '+x));
 return lines.join('\n')+'\n';
}

