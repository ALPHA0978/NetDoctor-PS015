'use strict';

const HISTORY_LIMIT = 40;
const EXAMPLES = [
  {id:'healthy',title:'Healthy connection',description:'A baseline for comparison.'},
  {id:'wifi',title:'Weak home Wi-Fi',description:'The delay starts before traffic leaves home.'},
  {id:'last-mile',title:'Possible provider-side issue',description:'The gateway looks healthy while multiple outside checks disagree with baseline.'},
  {id:'dns',title:'DNS resolution failure',description:'Devices connect, but name lookups are unreliable.'},
  {id:'ambiguous',title:'Not enough evidence',description:'Missing checks make a confident diagnosis impossible.'}
];
const ROWS = {
  healthy:[['Gateway latency',3,'ms','ok'],['External latency',28,'ms','ok'],['DNS time',20,'ms','ok']],
  wifi:[['Gateway latency',115,'ms','warning'],['Gateway packet loss',18,'%','warning'],['External latency',140,'ms','warning']],
  'last-mile':[['Gateway latency',4,'ms','ok'],['External endpoint A',245,'ms','warning'],['External endpoint B',210,'ms','warning']],
  dns:[['Gateway latency',4,'ms','ok'],['External latency',30,'ms','ok'],['DNS time',null,'ms','unavailable']],
  ambiguous:[['Gateway latency',null,'ms','unavailable'],['External latency',88,'ms','warning'],['DNS time',null,'ms','unavailable']]
};
const GUIDE = {
  healthy:['No clear fault in this window','Normal gateway and external checks are consistent with a healthy connection.','Try again while the issue is happening.'],
  wifi:['Likely home Wi-Fi problem','The gateway is slow before traffic reaches the wider internet.','Move closer to the router or connect by Ethernet, then retest.'],
  'last-mile':['Likely external connectivity issue','The local gateway looks healthy, but both external endpoints are slow. This is not proof of a provider fault.','Retest using Ethernet before sharing this report with support.'],
  dns:['Likely DNS problem','Network latency looks normal, but the name-resolution sample is unavailable.','Retry a familiar website, then check resolver settings with support.'],
  ambiguous:['Cannot isolate the fault','One external measurement is not enough to distinguish home Wi-Fi from the wider network.','Run again with gateway and external tests available.']
};
function simulate(scenario, access='unknown', now=new Date()) {
  const selected=EXAMPLES.find((x)=>x.id===scenario);
  if (!selected) throw new Error('Select a controlled example first.');
  const [title,summary,action]=GUIDE[scenario];
  return {
    id:'demo-'+now.getTime()+'-'+Math.random().toString(36).slice(2,9),
    mode:'demo', provenance:{source:'bundled-fixture'}, scenario, created_at:now.toISOString(), access,
    diagnosis:{code:scenario,title,confidence:scenario==='ambiguous'?'Inconclusive':'Illustrative',summary},
    measurements:ROWS[scenario].map(([label,value,unit,status],i)=>({id:label.toLowerCase().replace(/ /g,'-'),label,value,unit,status,detail:value===null?'This controlled fixture has no usable result.':'A synthetic baseline, not measured on this phone.'})),
    evidence:[selected.description, 'The app generated these values from a bundled controlled fixture.'],
    actions:[action],limitations:['Not live data. No network traffic was generated.', 'Illustrative thresholds are not a service-level guarantee.']
  };
}

function hostUrl(raw) {
  const value=raw.trim();
  if (!value) throw new Error('Enter the address of your own NetDoctor PC.');
  const result=/^https?:\/\/(localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3})(?::([0-9]{1,5}))?\/?$/i.exec(value);
  if (!result) throw new Error('Use a local IPv4 address, for example http://192.168.1.10:8765.');
  const [,host,port]=result;
  if (port && (+port<1 || +port>65535)) throw new Error('Enter a valid local port.');
  if (!['localhost','127.0.0.1'].includes(host.toLowerCase())) {
    const parts=host.split('.');
    if(parts.some(p=>p.length>1&&p.startsWith('0')))throw new Error('Enter the private address without leading zeros.');
    const [a,b,...remaining]=parts.map(Number);
    if ([a,b,...remaining].some(n=>n>255) || !(a===10 || a===192&&b===168 || a===172&&b>=16&&b<=31)) {
      throw new Error('Only private demo-network addresses and localhost are supported.');
    }
  }
  return value.replace(/\/$/,'');
}

function redact(raw) {
  return String(raw ?? '').slice(0,800)
    .replace(/\b(?:https?|ftp):\/\/[^\s<>"']+/gi,'[link removed]')
    .replace(/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi,'[device ID removed]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[address removed]')
    .replace(/(?<![a-z0-9])(?=[0-9a-f:]*:)[0-9a-f]{0,4}:(?:[0-9a-f]{0,4}:){1,6}[0-9a-f]{0,4}(?![a-z0-9])/gi,'[address removed]')
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g,'[email removed]')
    .replace(/\b(?:SSID|BSSID|hostname|gateway address|public IP)\s*[:=]\s*[^\n,;]+/gi,'[network identifier removed]');
}
const list=(v)=>Array.isArray(v)?v.slice(0,24).filter(i=>typeof i==='string').map(redact):[];
const tag=(v)=>typeof v==='string'&&/^[a-zA-Z0-9._-]{1,48}$/.test(v)?v:undefined;
function sanitize(report) {
  if (!report || typeof report.id!=='string' || !['demo','live','device'].includes(report.mode) ||
      !report.diagnosis || typeof report.diagnosis.title!=='string' ||
      Number.isNaN(new Date(report.created_at).valueOf())) throw new Error('The report could not be verified.');
  return {
    id:redact(report.id),mode:report.mode,scenario:typeof report.scenario==='string'?redact(report.scenario):null,
    provenance:{source:['bundled-fixture','controlled-loopback'].includes(report.provenance?.source)&&report.mode==='demo'?report.provenance.source:report.mode==='device'?'android-os':report.mode==='live'?'desktop-probe':'unspecified-demo',schema_version:tag(report.provenance?.schema_version),ruleset:tag(report.provenance?.ruleset)},
    created_at:new Date(report.created_at).toISOString(),access:['wifi','ethernet','cellular','unknown'].includes(report.access)?report.access:'unknown',
    diagnosis:{code:redact(report.diagnosis.code),title:redact(report.diagnosis.title),confidence:redact(report.diagnosis.confidence),summary:redact(report.diagnosis.summary)},
    measurements:(Array.isArray(report.measurements)?report.measurements:[]).slice(0,24).map(m=>({
      id:redact(m?.id),label:redact(m?.label),value:typeof m?.value==='number'?(Number.isFinite(m.value)?m.value:null):(typeof m?.value==='string'?redact(m.value):null),
      unit:redact(m?.unit),status:redact(m?.status),detail:redact(m?.detail)
    })),
    evidence:list(report.evidence),actions:list(report.actions),limitations:list(report.limitations)
  };
}

function fromDevice(state, now=new Date()) {
  const access={WIFI:'wifi',ETHERNET:'ethernet',CELLULAR:'cellular'}[state?.type]||'unknown';
  const net=state?.isInternetReachable;
  const conn=state?.isConnected;
  const text=(v)=>v===true?'Yes':v===false?'No':'Unknown';
  const title=conn===false?'Phone reports no connected link':net===false?'Phone reports no internet route':net===true?'Phone reports internet reachability':'Phone reachability is unknown';
  return {
    id:'device-'+now.getTime()+'-'+Math.random().toString(36).slice(2,9),mode:'device',created_at:now.toISOString(),access,
    diagnosis:{code:'device-status',title,confidence:'Status only',summary:'Read from Android. These indicators cannot isolate a fault to your Wi-Fi, your provider, or the wider internet.'},
    measurements:[
      {id:'link',label:'Connection type',value:access,unit:'',status:'observed',detail:'Reported by Android, not independently measured.'},
      {id:'connected',label:'A network is connected',value:text(conn),unit:'',status:conn===false?'warning':'observed',detail:'Operating-system connection state.'},
      {id:'internet',label:'Internet reachable',value:text(net),unit:'',status:net===false?'warning':'observed',detail:'Operating-system reachability flag, not an app-originated probe.'}
    ],
    evidence:['Read the current Android connectivity state.'],
    actions:['For a deeper diagnosis, use the desktop probe on the same network and compare the two perspectives.'],
    limitations:['No DNS, latency, packet-loss, throughput, SSID or location information was collected.']
  };
}

async function api(base,path,payload,request=fetch) {
  const controller=new AbortController();
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},payload?22000:5000);
  try {
    const res=await request(hostUrl(base)+path, {method:payload?'POST':'GET',
      headers:payload?{'Content-Type':'application/json'}:undefined,
      body:payload?JSON.stringify(payload):undefined,signal:controller.signal,redirect:'error'});
    if (!res.ok) throw new Error('NetDoctor PC returned HTTP '+res.status+'.');
    if (res.redirected) throw new Error('The local diagnostic server redirected the request.');
    return await res.json();
  } catch(error) { if(timedOut) throw new Error('NetDoctor PC did not respond in time.'); throw error; }
  finally { clearTimeout(timer); }
}

async function diagnoseDesktop(base,{kind,scenario,access='unknown'},request=fetch) {
  if (!['live','lab'].includes(kind)) throw new Error('Invalid desktop diagnostic mode.');
  if (kind==='lab' && !/^[a-zA-Z0-9_-]{1,48}$/.test(scenario ?? '')) throw new Error('Invalid lab scenario.');
  if (!['wifi','ethernet','unknown'].includes(access)) throw new Error('Invalid PC connection type.');
  const result=await api(base,'/diagnose',kind==='lab'?{mode:'demo',scenario,access}:{mode:'live',access},request);
  if (kind==='live' && result?.mode!=='live') throw new Error('The PC did not return a live result. Nothing was saved as live.');
  if (kind==='lab' && (result?.mode!=='demo'||result?.scenario!==scenario||result?.provenance?.source!=='controlled-loopback')) throw new Error('The PC did not return a measured result for this lab scenario.');
  return sanitize(result);
}

function comparable(a,b) {
  return !!(a&&b&&a.id!==b.id&&a.mode===b.mode&&a.access===b.access&&
    a.probeSerial===b.probeSerial&&a.provenance?.ruleset===b.provenance?.ruleset&&
    (a.mode!=='demo'||(a.provenance?.source||'legacy')===(b.provenance?.source||'legacy')&&
      (a.scenario===b.scenario||b.provenance?.source==='controlled-loopback'&&b.scenario==='control')));
}
function difference(baseline,current) {
  if(!comparable(baseline,current))return [];
  const before=new Map(baseline.measurements.map(m=>[m.id,m]));
  return current.measurements.flatMap(m=>{
    const old=before.get(m.id);
    if(!old||typeof old.value!=='number'||typeof m.value!=='number'||old.unit!==m.unit)return [];
    const delta=Math.round((m.value-old.value)*100)/100;
    return [{id:m.id,label:m.label,unit:m.unit,before:old.value,after:m.value,delta}];
  });
}
function exportReport(report,baseline) {
  const current=sanitize(report);
  const prior=baseline&&comparable(baseline,report)?sanitize(baseline):null;
  const payload={schema:'netdoctor.mobile.evidence.v1',scope:{live:'Desktop probe',device:'This phone: connection status only',demo:current.provenance.source==='controlled-loopback'?'Measured desktop lab on controlled loopback':'Synthetic controlled example'}[current.mode],report:current};
  if(prior)payload.comparison={baseline_id:prior.id,baseline_at:prior.created_at,kind:prior.scenario!==current.scenario?'fault-to-clean-control':'same-setup-retest',metrics:difference(prior,current)};
  return JSON.stringify(payload,null,2);
}
module.exports={EXAMPLES,HISTORY_LIMIT,simulate,hostUrl,sanitize,fromDevice,api,diagnoseDesktop,comparable,difference,exportReport};
