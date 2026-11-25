export type Access = 'wifi' | 'ethernet' | 'unknown';
export type Mode = 'demo' | 'live';
export type Observation = {id:string;label:string;value:string|number|boolean|null;unit?:string;status:string;detail?:string};
export type Scenario = { id:string; title:string; description:string };
type Diagnosis = {code:string;title:string;confidence:string|number;summary:string};
export type Report = {id:string;mode:Mode;scenario?:string|null;created_at:string;access:Access;diagnosis:Diagnosis;measurements:Observation[];evidence:string[];actions:string[];limitations:string[]; source?:'offline-fixture'|'collector'|'controlled-loopback'|'measured'};
export const scenarios:Scenario[] = [
 {id:'healthy',title:'Healthy connection',description:'A clean baseline with working local and internet paths.'},
 {id:'wifi',title:'Local Wi-Fi trouble',description:'Loss begins at the home gateway, before traffic leaves the home.'},
 {id:'dns',title:'DNS resolution trouble',description:'IP traffic succeeds while the configured resolver fails.'},
 {id:'upstream',title:'Possible upstream issue',description:'The local gateway is healthy; paths beyond it degrade.'},
 {id:'gateway',title:'Gateway unreachable',description:'The local gateway does not respond in this controlled sample.'},
 {id:'packet_loss',title:'Induced packet loss',description:'An engineered loss pattern demonstrates repeated sampling.'},
 {id:'congestion',title:'Loaded versus idle delay',description:'A controlled delay increases latency under load.'},
 {id:'inconclusive',title:'Incomplete evidence',description:'Only part of the path is observed, so no cause can be isolated.'},
];
const m=(id:string,label:string,value:Observation['value'],unit:string,status:string,detail:string):Observation=>({id,label,value,unit,status,detail});
const fixture:Record<string,{diagnosis:Diagnosis;measurements:Observation[];evidence:string[];actions:string[]}> = {
 healthy:{diagnosis:{code:'healthy',title:'Connection looks healthy',confidence:'Strong evidence',summary:'All sampled stages worked during the test window. Intermittent issues outside this window remain possible.'},measurements:[m('gateway','Gateway latency',4,'ms','good','5/5 replies from local gateway'),m('end','External latency',26,'ms','good','5/5 replies to the reference endpoint'),m('dns','DNS resolution',22,'ms','good','Reference name resolved'),m('loss','External packet loss',0,'%','good','No loss in the sample')],evidence:['The local gateway responded consistently.','Both DNS resolution and public connectivity were available.'],actions:['Repeat when you notice a slowdown.','Compare the new sample in History.']},
 wifi:{diagnosis:{code:'local-link',title:'Likely local Wi-Fi degradation',confidence:'Strong evidence',summary:'Packet loss and delay are already visible on the first hop. These observations point to the local link, not a confirmed provider outage.'},measurements:[m('gateway','Gateway latency',84,'ms','warning','3/5 gateway replies; 40% loss'),m('end','External latency',118,'ms','warning','3/5 external replies'),m('dns','DNS resolution',76,'ms','good','Reference name resolved'),m('loss','External packet loss',40,'%','warning','Loss begins before the provider')],evidence:['The local gateway lost 2 of 5 replies.','Similar loss outside the home suggests the external path may be inheriting local problems.','The device was reported as connected by Wi-Fi; the probe does not identify radio interference.'],actions:['Move closer to the router and repeat.','Repeat on Ethernet if available to isolate the wireless hop.','If the wired run is also poor, inspect the local router and cabling.']},
 dns:{diagnosis:{code:'dns',title:'Likely DNS resolution issue',confidence:'Strong evidence',summary:'The local and external IP path respond, but the configured resolver could not resolve a reference name.'},measurements:[m('gateway','Gateway latency',4,'ms','good','5/5 gateway replies'),m('end','External latency',31,'ms','good','Reference IP reachable'),m('dns','DNS resolution','Timeout','','warning','Configured resolver did not respond'),m('loss','External packet loss',0,'%','good','No loss in the sample')],evidence:['The reference endpoint was reachable by IP.','DNS timed out independently of the IP check.'],actions:['Confirm whether multiple websites are affected.','Restart the router if appropriate and repeat.','Share the evidence with network support if the resolver still times out.']},
 upstream:{diagnosis:{code:'upstream',title:'Possible issue beyond your router',confidence:'Moderate evidence',summary:'The first hop stayed healthy while more distant checks degraded. The sample does not identify which external operator or link is responsible.'},measurements:[m('gateway','Gateway latency',4,'ms','good','5/5 gateway replies'),m('end','External latency',220,'ms','warning','3/5 external replies'),m('dns','DNS resolution',32,'ms','good','Reference name resolved'),m('loss','External packet loss',40,'%','warning','2/5 reference replies missing')],evidence:['Gateway response was healthy while the external reference check degraded.','DNS answered, so DNS alone does not explain the failures.'],actions:['Retest from Ethernet, if available.','If it persists on another device, export and share this evidence with your provider.']},
 gateway:{diagnosis:{code:'gateway',title:'Local gateway does not respond',confidence:'Strong evidence in sample',summary:'The first-hop probe and dependent routes failed in this controlled case. This does not distinguish the access medium or the device causing the issue.'},measurements:[m('gateway','Gateway replies',0,'/ 5','failed','All first-hop requests timed out'),m('end','External reachability','Unavailable','','neutral','External path was not established')],evidence:['No gateway response was observed.','There is no independent evidence implicating the service provider.'],actions:['Check that the device is connected to the expected network.','Compare another device on the same network, then retest.']},
 packet_loss:{diagnosis:{code:'packet_loss',title:'Packet loss observed beyond the gateway',confidence:'Moderate evidence in sample',summary:'External probes were lost while the local sample stayed stable. The evidence does not identify a particular operator, cable, or relay.'},measurements:[m('gateway','Gateway packet loss',0,'%','good','All local samples arrived'),m('loss','Reference-path packet loss',30,'%','warning','3 of 10 reference samples were lost')],evidence:['Loss was introduced explicitly in the controlled external path.','The first hop stayed responsive during the sample.'],actions:['Retest from another device or wired access when possible.','Export repeated loss observations for further investigation.']},
 congestion:{diagnosis:{code:'congestion',title:'Delay rises under controlled load',confidence:'Moderate evidence in sample',summary:'The loaded sample was slower than the idle sample. Queueing is consistent with this evidence, but the test does not locate the physical bottleneck.'},measurements:[m('idle','Idle latency',24,'ms','good','Without competing traffic'),m('loaded','Loaded latency',194,'ms','warning','With controlled competing traffic')],evidence:['Latency rose by 170 ms during the controlled load.','The symptom eased when the load stopped.'],actions:['Pause known large transfers and retest.','If the pattern repeats, share idle and loaded values together.']},
 inconclusive:{diagnosis:{code:'inconclusive',title:'Not enough evidence to isolate a cause',confidence:'Limited evidence',summary:'Missing first-hop observations prevent a reliable comparison between your home network and the outside path.'},measurements:[m('gateway','Gateway latency',null,'ms','unavailable','No usable gateway sample'),m('dns','DNS resolution',34,'ms','good','Reference name resolved')],evidence:['No usable first-hop sample was available.','DNS success alone cannot rule out local or upstream packet loss.'],actions:['Confirm that you are on the affected home network.','Repeat on a desktop with the local collector and compare a second device.']},
};
export function newFixture(id:string,access:Access):Report {
 const f=fixture[id]; if(!f) throw new Error('This scenario needs the local collector.');
 return {id:Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''),mode:'demo',scenario:id,created_at:new Date().toISOString(),access:id==='wifi'?'wifi':access,source:'offline-fixture',diagnosis:{...f.diagnosis},measurements:f.measurements.map(x=>({...x})),evidence:[...f.evidence],actions:[...f.actions],limitations:['Controlled sample data. No traffic was sent and these are not measurements of your network.','Example observations illustrate how the classifier explains a diagnosis.']};
}
export function safeCollector(value:string|undefined):string {
 const u=new URL(value?.trim()||'http://127.0.0.1:8765');
 const host=u.hostname.toLowerCase();
 const privateHost=host==='localhost'||host==='127.0.0.1'||host==='[::1]'||host.endsWith('.local')||/^10\.(\d{1,3}\.){2}\d{1,3}$|^192\.168\.\d{1,3}\.\d{1,3}$|^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
 if(!privateHost||!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/') throw new Error('Use a local or private-network collector URL without a path.');
 return u.origin;
}
const boundedText=(x:unknown,n=3000):x is string=>typeof x==='string'&&x.length>0&&x.length<=n;
function rec(x:unknown):x is Record<string,unknown>{ return typeof x==='object'&&x!==null&&!Array.isArray(x);}
const strings=(x:unknown):x is string[]=>Array.isArray(x)&&x.length<=100&&x.every(v=>boundedText(v));
export function parseReport(data:unknown,expectedMode?:Mode):Report {
 if(!rec(data)||!boundedText(data.id,160)||!(/^[a-z\d_.-]+$/i.test(data.id))||!boundedText(data.created_at,120)||!Number.isFinite(Date.parse(data.created_at))||
    (data.mode!=='live'&&data.mode!=='demo')||(expectedMode&&data.mode!==expectedMode)||
    (data.mode==='live'&&(['offline-fixture','controlled-loopback','fixture'].includes(String(data.source))||(rec(data.provenance)&&['offline-fixture','controlled-loopback','fixture'].includes(String(data.provenance.source)))))||
    !['wifi','ethernet','unknown'].includes(String(data.access))||!rec(data.diagnosis)||
    !boundedText(data.diagnosis.code,120)||!boundedText(data.diagnosis.title)||!boundedText(data.diagnosis.summary)||
    !(boundedText(data.diagnosis.confidence,120)||(typeof data.diagnosis.confidence==='number'&&Number.isFinite(data.diagnosis.confidence)))||
    !Array.isArray(data.measurements)||data.measurements.length>100||
    !data.measurements.every(x=>rec(x)&&boundedText(x.id,120)&&boundedText(x.label,300)&&
       (x.value===null||['string','boolean','number'].includes(typeof x.value))&&
       (typeof x.value!=='number'||Number.isFinite(x.value))&&
       (x.unit===undefined||typeof x.unit==='string')&&typeof x.status==='string'&&
       (x.detail===undefined||typeof x.detail==='string'))||
    !strings(data.evidence)||!strings(data.actions)||!strings(data.limitations)) throw new Error('Collector returned an incompatible report. No results were saved.');
 const {id,mode,created_at,access,diagnosis,measurements,evidence,actions,limitations}=data as Report;
 return {id,mode,created_at,access,diagnosis:{code:diagnosis.code,title:diagnosis.title,summary:diagnosis.summary,confidence:diagnosis.confidence},measurements:measurements.map(({id,label,value,unit,status,detail})=>({id,label,value,...(unit!==undefined?{unit}:{}),status,...(detail!==undefined?{detail}:{})})),evidence,actions,limitations,scenario:typeof data.scenario==='string'?data.scenario:null,source:data.source==='offline-fixture'?'offline-fixture':rec(data.provenance)&&data.provenance.source==='controlled-loopback'&&mode==='demo'?'controlled-loopback':data.source==='controlled-loopback'&&mode==='demo'?'controlled-loopback':data.source==='measured'?'measured':'collector'};
}
export function updateHistory(items:Report[], next:Report,limit=16){return [next,...items.filter(r=>r.id!==next.id)].slice(0,limit);}
export function readHistory(raw:string|null):Report[] {
 if(!raw)return [];
 try{const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed))return [];return parsed.slice(0,16).flatMap(x=>{try{return [parseReport(x)];}catch{return [];}});}catch{return [];}
}
export function output(report:Report):string {
 return JSON.stringify({schema:'netdoctor.evidence.v1',...parseReport(report)},null,2);
}
export function confidenceLabel(value:Diagnosis['confidence']) {return typeof value==='number' ? (value>=0&&value<=1 ? Math.round(value*100)+'% confidence score' : String(value)+' confidence score') : value.replaceAll('_',' ');}
export const accessLabel:Record<Access,string>={wifi:'Wi-Fi',ethernet:'Ethernet',unknown:'Not specified'};
export function observationTone(s:string) {return ['healthy','good','ok','pass','success','normal','reachable'].includes(s.toLowerCase())?'good':['warning','warn','failed','poor','error','degraded','bad','timeout','fail','loss','down'].includes(s.toLowerCase())?'warning':'neutral';}
export async function readAPI(path:string,init?:RequestInit) {
 const base=safeCollector(process.env.NEXT_PUBLIC_NETDOCTOR_API);
 const signal=init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(40000)]):AbortSignal.timeout(2500);
 const res=await fetch(base+path,{...init,signal,credentials:'omit',cache:'no-store',redirect:'error'});
 if(!res.ok)throw new Error('Collector request failed (HTTP '+res.status+').');
 return res.json() as Promise<unknown>;
}
export function readScenarios(raw:unknown):Scenario[] {
 const rows=Array.isArray(raw)?raw:rec(raw)&&Array.isArray(raw.scenarios)?raw.scenarios:[];
 return rows.slice(0,30).filter((r):r is Scenario=>rec(r)&&boundedText(r.id,100)&&boundedText(r.title,300)&&boundedText(r.description,1000));
}


export function compareMeasurements(before:Report,after:Report){
 if(before.mode!==after.mode||before.access!==after.access||before.source!==after.source|| (before.scenario!==after.scenario && !(before.source==='controlled-loopback'&&after.scenario==='control')))return [];
 const prior=new Map(before.measurements.map(x=>[x.id,x]));
 return after.measurements.flatMap(a=>{const b=prior.get(a.id);return b&&typeof a.value==='number'&&typeof b.value==='number'&&a.unit===b.unit?[{id:a.id,label:a.label,before:b.value,after:a.value,unit:a.unit??''}]:[];});
}
