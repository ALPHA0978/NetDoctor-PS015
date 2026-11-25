// Local-only Chrome DevTools smoke using an isolated, temporary profile.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import os from 'node:os';
import path from 'node:path';
const chromium=process.env.NETDOCTOR_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'netdoctor-chrome-'));
const proc=spawn(chromium,['--headless','--disable-gpu','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;
let unexpectedError;
proc.on('error',err=>{unexpectedError=err});
const poll=async(fn,ms=12500)=>{for(const end=Date.now()+ms;Date.now()<end;){const hit=await fn();if(hit)return hit;await sleep(180);}throw new Error('Browser assertion timed out');};
try{
 const p=await poll(async()=>{if(unexpectedError)throw unexpectedError;if(proc.exitCode!==null)throw new Error('Chrome exited early '+proc.exitCode);try{return (await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];}catch{return false;}});
 const [page]=await (await fetch('http://127.0.0.1:'+p+'/json/list')).json();
 socket=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let id=0;const pending=new Map();
 const exceptions=[];
 socket.addEventListener('message',evt=>{const data=JSON.parse(evt.data);if(data.id){const done=pending.get(data.id);pending.delete(data.id);if(done){data.error?done.reject(new Error(data.error.message)):done.resolve(data.result);}}else if(data.method==='Runtime.exceptionThrown'){exceptions.push(data.params.exceptionDetails.text);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const jid=++id;pending.set(jid,{resolve,reject});socket.send(JSON.stringify({id:jid,method,params}));});
 const js=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
 const body=(s)=>js('document.body.innerText.includes('+JSON.stringify(s)+')');
 const btn=(text)=>js("(()=>{const el=[...document.querySelectorAll('button')].find(el=>el.textContent.replace(/\\s+/g,'')==="+JSON.stringify(text.replace(/\s+/g,''))+");if(!el||el.disabled)return false;el.click();return true})()");
 const viewport=(width,height,mobile)=>call('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});
 const shot=async(name)=>{const r=await call('Page.captureScreenshot',{format:'png'});await fs.mkdir('qa',{recursive:true});await fs.writeFile(path.join('qa',name+'.png'),Buffer.from(r.data,'base64'));};
 await call('Page.enable');await call('Runtime.enable');await viewport(1365,1000,false);
 await call('Page.navigate',{url:process.env.NETDOCTOR_WEB_URL||'http://127.0.0.1:3000/'});
 await poll(()=>body('Collector online')); // wait for React effects, not just SSR
 await shot('web-desktop');
 assert.equal(await btn('Run demo'),true);await poll(()=>body('Controlled loopback'));
 assert.equal(await body('Evidence behind the result'),true);
 assert.equal(await btn('Retest'),true);await poll(()=>body('Before and after'));
 await shot('web-retest');
 assert.equal(await btn('History02'),true);await poll(()=>body('Review the latest 16 reports'));
 assert.equal(await btn('Clear local history'),true);await poll(()=>body('Remove all reports'));assert.equal(await btn('Clear reports'),true);await poll(()=>body('Nothing saved yet'));
 assert.equal(await btn('Open Diagnose'),true);
 for(const width of [390,320]){
  await viewport(width,850,true);
  assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true,'horizontal overflow at '+width);
  await shot('web-mobile-'+width);
 }
 assert.deepEqual(exceptions,[]);
 console.log('Chrome smoke passed: load, controlled run, retest, history, delete and 390/320px sizing.');
}finally{
 socket?.close();
 proc.kill();
 try{await fs.rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:250});}catch{}
}

