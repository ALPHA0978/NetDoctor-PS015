'use strict';
const {app,BrowserWindow,ipcMain,dialog,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const {Resolver}=require('node:dns/promises');
const {isIP}=require('node:net');
const {fileURLToPath,pathToFileURL}=require('node:url');
const M=require('./model.js');
const network=require('./network-monitor.cjs');
const {backendEnvironment}=require('./gemini-env.cjs');
const reverseDns=new Resolver({timeout:2500,tries:1});
const pendingLookups=new Map();
const configuredPort=Number(process.env.NETDOCTOR_DESKTOP_PORT);
const port=Number.isInteger(configuredPort)&&configuredPort>=1024&&configuredPort<=65535?configuredPort:0;
const page=pathToFileURL(path.join(__dirname,'index.html')).href;
let win, child, starting, host, quitting=false;
function waitForBackend(process){
  return new Promise(resolve=>{
    const output=createInterface({input:process.stdout});
    const timer=setTimeout(()=>finish(null),6000);
    function finish(url){
      clearTimeout(timer);
      output.close();
      process.stdout.resume();
      process.off('error',failed);
      process.off('exit',failed);
      resolve(url);
    }
    const failed=()=>finish(null);
    process.once('error',failed);
    process.once('exit',failed);
    output.on('line',line=>{
      const match=/^NetDoctor ready at (http:\/\/127\.0\.0\.1:(\d{1,5}))$/.exec(line);
      if(match && Number(match[2])>0 && Number(match[2])<=65535 && (!port || Number(match[2])===port)){
        finish(match[1]);
      }
    });
  });
}
async function ensure(){
  if(quitting)return null;
  if(child&&host)return host;
  if(starting) return starting;
  starting=(async()=>{
    const script=path.join(__dirname,'..','backend','server.py');
    try{await fs.access(script);}catch{return null}
    const env=await backendEnvironment();
    const candidates=process.platform==='win32'?[['python',[]],['py',['-3']]]:[['python3',[]]];
    for(const [program,args] of candidates){
      if(quitting)return null;
      const p=spawn(program,[...args,script,'--host','127.0.0.1','--port',String(port)],{cwd:path.dirname(script),env,windowsHide:true,stdio:['ignore','pipe','ignore'],shell:false});
      child=p;
      const reset=()=>{if(child===p){child=null;host=null;}};
      p.once('exit',reset);
      p.on('error',reset);
      const ready=await waitForBackend(p);
      if(ready&&child===p&&!quitting){host=ready;return ready;}
      if(child===p){reset();p.kill();}
    }
    return null;
  })();
  try{return await starting;}finally{starting=null}
}
function source(event){
  if(!win || event.sender!==win.webContents || event.senderFrame!==event.sender.mainFrame || event.senderFrame.url.split('#',1)[0]!==page)throw Error('Unrecognized caller');
}
function create(){
  win=new BrowserWindow({width:1280,height:860,minWidth:700,minHeight:610,backgroundColor:'#091219',title:'NetDoctor | Network diagnostics',show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  if(process.env.NETDOCTOR_DESKTOP_SMOKE!=='1')win.once('ready-to-show',()=>win.show());
  win.loadFile(fileURLToPath(page));
}
app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  ipcMain.handle('netdoctor:connect',async(event)=>{source(event);return Boolean(await ensure())});
  ipcMain.handle('netdoctor:network',async(event,selected=null)=>{
    source(event);
    if(selected!==null && (typeof selected!=='string' || !/^[^\x00-\x1f]{1,128}$/.test(selected)))throw Error('Invalid process name');
    return network.snapshot(selected);
  });
  ipcMain.handle('netdoctor:reverse-dns',async(event,address)=>{
    source(event);
    if(typeof address!=='string'||address.includes('%')||!isIP(address))throw Error('Invalid IP address');
    if(pendingLookups.has(address))return pendingLookups.get(address);
    if(pendingLookups.size>=4)return {state:'unavailable'};
    const lookup=reverseDns.reverse(address)
      .then(names=>names.length?{state:'found',names}:{state:'missing'})
      .catch(error=>({state:['ENOTFOUND','ENODATA'].includes(error.code)?'missing':'unavailable'}))
      .finally(()=>pendingLookups.delete(address));
    pendingLookups.set(address,lookup);
    return lookup;
  });
  ipcMain.handle('netdoctor:check-destination',async(event,appName,address,port)=>{
    source(event);
    return network.checkDestination(appName,address,port);
  });
  ipcMain.handle('netdoctor:diagnose',async(event,mode,access,scenario)=>{
    source(event);
    if(!['wifi','ethernet','unknown'].includes(access))throw Error('Invalid connection type');
    if(mode!=='live'&&(mode!=='lab'||!M.labScenarios.some(c=>c.id===scenario)))throw Error('Invalid measurement mode or lab scenario');
    const backend=await ensure();
    if(!backend)throw Error('The local Python service is unavailable. Check Python 3 and the sibling backend folder, or choose a controlled scenario.');
    const response=await fetch(backend+'/diagnose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='live'?{mode:'live',access}:{mode:'demo',access,scenario}),redirect:'error',signal:AbortSignal.timeout(35000)});
    if(!response.ok)throw Error('The local test could not complete (HTTP '+response.status+'). Please retry.');
    const raw=await response.json();
    if(mode==='live'&&raw?.provenance?.source!=='python-host')throw Error('Host measurements were not verified.');
    const result=M.normalize(raw);
    if(mode==='lab'&&M.source(result)!=='controlled-loopback')throw Error('The service did not return measured lab evidence. Update the Python backend.');
    if(mode==='live'&&M.source(result)!=='python-host')throw Error('The service did not return live host evidence.');
    return result;
  });
  ipcMain.handle('netdoctor:explain',async(event,runId)=>{
    source(event);
    if(typeof runId!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(runId))throw Error('Invalid run ID');
    const backend=await ensure();
    if(!backend)throw Error('Start the local measurement service first.');
    const r=await fetch(backend+'/explain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_id:runId,consent:true}),redirect:'error',signal:AbortSignal.timeout(28000)});
    const data=await r.json();
    if(r.status===503 && /^Gemini is not configured/.test(data.error||'')){
      throw Error('Gemini key unavailable. Save it with Run-Gemini-Demo.ps1 -SetKey, then restart NetDoctor under the same Windows account.');
    }
    if(!r.ok)throw Error(data.error||'Gemini is unavailable.');
    return data;
  });
  ipcMain.handle('netdoctor:save',async(event,format,report)=>{
    source(event);
    if(!['json','html','pdf'].includes(format))throw Error('Invalid format');
    const clean=M.normalize(report);
    const picked=await dialog.showSaveDialog(win,{title:'Save redacted evidence',defaultPath:'NetDoctor-'+clean.id+'.'+format,filters:[{name:format.toUpperCase()+' evidence',extensions:[format]}]});
    if(picked.canceled||!picked.filePath)return false;
    if(format==='pdf'){
      const pdfWindow=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
      try{
        await pdfWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(M.html(clean)));
        await fs.writeFile(picked.filePath,await pdfWindow.webContents.printToPDF({pageSize:'A4',printBackground:true}));
      }finally{pdfWindow.destroy();}
    }else{
      const body=format==='html'?M.html(clean):JSON.stringify(clean,null,2);
      await fs.writeFile(picked.filePath,body,'utf8');
    }
    return true;
  });
  create();
  app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)create();});
});
app.on('before-quit',()=>{quitting=true;if(child)child.kill();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
