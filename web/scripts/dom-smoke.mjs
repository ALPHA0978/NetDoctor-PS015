// Exercises the actual production bundle, including React hydration, without a GUI.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { MessageChannel } from 'node:worker_threads';
const require=createRequire(import.meta.url);
const { JSDOM,VirtualConsole } = require(process.env.NETDOCTOR_JSDOM||'jsdom');
const url = process.env.NETDOCTOR_WEB_URL || 'http://127.0.0.1:3000/';
const errors=[];
const v=new VirtualConsole();
v.on('jsdomError',e=>{if(!String(e.message).includes('Could not parse CSS stylesheet'))errors.push(e.cause??e);});
const dom=await JSDOM.fromURL(url,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:v,beforeParse(w){
 for(const n of ['AbortController','AbortSignal','TextEncoder','TextDecoder','ReadableStream','TransformStream','ReadableStreamDefaultReader','Request','Response','Headers','structuredClone'])if(globalThis[n])w[n]=globalThis[n];
 w.MessageChannel=MessageChannel;
 w.fetch=(input,init)=>fetch(typeof input==='string'?new URL(input,url):input,init);
 w.print=()=>{w.__printed=true};
 w.URL.createObjectURL=()=>{w.__exported=true;return 'blob:netdoctor-test'};
 w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){};
}});
const doc=dom.window.document;
const show=()=>doc.body.textContent.replace(/\s+/g,' ');
const click=(label)=>{const el=[...doc.querySelectorAll('button')].find(b=>b.textContent.replace(/\s+/g,'')===label.replace(/\s+/g,''));assert.ok(el&&!el.disabled,'Clickable '+label);el.click();};
async function until(s,n=10000){const deadline=Date.now()+n;while(Date.now()<deadline){if(errors.length)throw errors[0];if(show().includes(s))return;await sleep(45);}throw new Error('Missing UI text: '+s+', page begins '+show().slice(0,500));}
try{
 await until('Collector online');
 click('Dark theme');assert.equal(doc.documentElement.dataset.theme,'dark');
 assert.equal(dom.window.localStorage.getItem('netdoctor.web.theme'),'dark');
 await until('Light theme'); click('Light theme');assert.equal(doc.documentElement.dataset.theme,'light');
 click('Run demo');await until('Controlled loopback');
 await until('Evidence behind the result');
 await until('Focus on the strongest evidence');
 const optIn=[...doc.querySelectorAll('button')].find(b=>b.textContent==='Share readings and explain');
 assert.ok(optIn?.disabled,'Gemini stays disabled without a configured key');
 click('JSON');assert.equal(dom.window.__exported,true);
 click('Print / PDF');assert.equal(dom.window.__printed,true);
 click('Retest without fault');await until('Lab fault removed for this comparison.');
 click('History02');await until('Review the latest 16 reports');
 click('Clear local history');await until('Remove all reports');click('Clear reports');await until('Nothing saved yet');
 for(let i=0;i<20&&dom.window.localStorage.getItem('netdoctor-history-v1')!=='[]';i++)await sleep(30);
 assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('netdoctor-history-v1')),[]);
 assert.deepEqual(errors,[]);
 console.log('DOM smoke passed with production bundle: hydration, case, export, print, retest, history, and clearing.');
}finally{dom.window.close();}
process.exit(0);

