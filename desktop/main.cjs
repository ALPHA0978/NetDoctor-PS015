'use strict';
const {app,BrowserWindow,ipcMain,dialog,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {fileURLToPath,pathToFileURL}=require('node:url');
const M=require('./model.js');
const configuredPort=Number(process.env.NETDOCTOR_DESKTOP_PORT);
const port=Number.isInteger(configuredPort)&&configuredPort>=1024&&configuredPort<=65535?configuredPort:8765;
const host='http://127.0.0.1:'+port;
const page=pathToFileURL(path.join(__dirname,'index.html')).href;
let win, child, starting;
const delay=ms=>new Promise(done=>setTimeout(done,ms));
async function health(){
  try{
    const reply=await fetch(host+'/health',{signal:AbortSignal.timeout(1000),redirect:'error'});
    if(!reply.ok)return false;
    const info=await reply.json();
    return info && info.status==='ok' && info.name==='NetDoctor' && info.measurement_host==='python';
  }catch{return false}
}
async function ensure(){
  if(await health()) return true;
  if(starting) return starting;
  starting=(async()=>{
    const script=path.join(__dirname,'..','backend','server.py');
    try{await fs.access(script);}catch{return false}
    if(!child){
      const candidates=process.platform==='win32'?[['python',[]],['py',['-3']]]:[['python3',[]]];
      for(const [program,args] of candidates){
        const p=spawn(program,[...args,script,'--host','127.0.0.1','--port',String(port)],{cwd:path.dirname(script),windowsHide:true,stdio:'ignore',shell:false});
        const launched=await new Promise(resolve=>{p.once('spawn',()=>resolve(true));p.once('error',()=>resolve(false));});
        if(!launched)continue;
        child=p;
        p.once('exit',()=>{if(child===p)child=null});
        for(let i=0;i<15;i++){if(await health())return true;if(child!==p)break;await delay(180);}
        if(child===p)return false;
      }
    }else{for(let i=0;i<10;i++){if(await health())return true;await delay(180);}}
    return false;
  })();
  try{return await starting;}finally{starting=null}
}
function source(event){
  if(!win || event.sender!==win.webContents || event.senderFrame!==event.sender.mainFrame || event.senderFrame.url!==page)throw Error('Unrecognized caller');
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
  ipcMain.handle('netdoctor:connect',async(event)=>{source(event);return ensure()});
  ipcMain.handle('netdoctor:diagnose',async(event,mode,access,scenario)=>{
    source(event);
    if(!['wifi','ethernet','unknown'].includes(access))throw Error('Invalid connection type');
    if(mode!=='live'&&(mode!=='lab'||!M.labScenarios.some(c=>c.id===scenario)))throw Error('Invalid measurement mode or lab scenario');
    if(!await ensure())throw Error('The local Python service is unavailable. Check Python 3 and the sibling backend folder, or choose a controlled scenario.');
    const response=await fetch(host+'/diagnose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='live'?{mode:'live',access}:{mode:'demo',access,scenario}),redirect:'error',signal:AbortSignal.timeout(35000)});
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
    if(!await ensure())throw Error('Start the local measurement service first.');
    const r=await fetch(host+'/explain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_id:runId,consent:true}),redirect:'error',signal:AbortSignal.timeout(15000)});
    const data=await r.json();
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
app.on('before-quit',()=>{if(child)child.kill();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
