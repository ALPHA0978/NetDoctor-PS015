// Verifies the production React bundle and real Python lab on loopback only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {setTimeout as sleep} from 'node:timers/promises';
import {MessageChannel} from 'node:worker_threads';
const require=createRequire(import.meta.url);
const {JSDOM,VirtualConsole}=require(process.env.NETDOCTOR_JSDOM||'jsdom');
const webURL=process.env.NETDOCTOR_WEB_URL||'http://127.0.0.1:3000/';
const collectorURL=process.env.NETDOCTOR_SMOKE_COLLECTOR||'http://127.0.0.1:8765';
const origin=new URL(webURL).origin;
const offline=process.argv.includes('--offline');
const errors=[],runs=[],files=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!String(e.message).includes('Could not parse CSS stylesheet'))errors.push(e.cause??e);});
const dom=await JSDOM.fromURL(webURL,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 for(const n of ['Blob','AbortController','AbortSignal','TextEncoder','TextDecoder','ReadableStream','TransformStream','ReadableStreamDefaultReader','Request','Response','Headers','structuredClone'])if(globalThis[n])w[n]=globalThis[n];
 w.MessageChannel=MessageChannel;
 const random=w.crypto.getRandomValues.bind(w.crypto);
 w.crypto.getRandomValues=(a)=>a.constructor.name==='Uint32Array'&&a.length===1?(a[0]=4294967295,a):random(a);
 w.fetch=async(input,init)=>{
  const incoming=new URL(input,webURL);
  if(!['/health','/scenarios','/diagnose'].includes(incoming.pathname))throw Error('Unexpected fetch in lab smoke: '+incoming.pathname);
  if(offline)throw new TypeError('Collector disconnected for smoke test');
  if(init?.body)runs.push(JSON.parse(init.body));
  const dest=new URL(incoming.pathname,collectorURL);
  const response=await fetch(dest,{...init,headers:{...init?.headers,origin}});
  assert.equal(response.headers.get('access-control-allow-origin'),origin);
  return response;
 };
 w.URL.createObjectURL=blob=>{files.push(blob);return 'blob:netdoctor-test';};
 w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){};
}});
const d=dom.window.document;
const button=text=>[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
const click=text=>{const b=button(text);assert.ok(b&&!b.disabled,'Expected enabled '+text);b.click();};
const until=async f=>{for(let i=0;i<260;i++){if(errors.length)throw errors[0];const r=f();if(r)return r;await sleep(45);}throw Error('missing expected UI state: '+d.body.textContent.slice(-900));};
const has=s=>()=>d.body.textContent.includes(s);
const storage=()=>JSON.parse(dom.window.localStorage.getItem('netdoctor-history-v1')||'[]');
try{
 if(offline){
  await until(has('Offline demo available'));assert.ok(button('Pick a fault').disabled);
  click('Run demo');await until(has('Controlled example · not measured'));assert.equal(runs.length,0);
  console.log('PASS offline demo stays a fixture; blind control is unavailable without a collector.');
 }else{
  await until(has('Collector online'));
  click('Pick a fault');await until(has('The injected condition is hidden.'));
  assert.equal(runs[0].scenario,'ambiguous');assert.equal(runs[0].mode,'demo');
  assert.match(d.getElementById('result-title').textContent,/inconclusive|insufficient|undetermined/i);
  assert.equal(storage().length,0);assert.ok(!button('Support note'));assert.ok(!button('JSON'));assert.ok(!button('Retest without fault'));
  click('Reveal injected condition');await until(has('Injected lab condition: Conflicting / insufficient evidence.'));
  await until(()=>storage().length===1);
  click('Retest without fault');await until(has('Lab fault removed for this comparison.'));
  assert.equal(runs[1].scenario,'control');
  click('Support note');
  const note=await files[0].text();
  assert.match(note,/Controlled lab only/);assert.match(note,/not a household recovery/);
  assert.match(note,/INITIAL VERDICT[\s\S]+DECIDING EVIDENCE[\s\S]+RETEST[\s\S]+SAFE NEXT STEP/);
  assert.equal(errors.length,0);
  console.log('PASS measured ambiguous hidden/revealed, clean control, support export and history deferral.');
 }
}finally{dom.window.close();}
process.exit(0);

