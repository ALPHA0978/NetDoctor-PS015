const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('netdoctor',Object.freeze({
 connect:()=>ipcRenderer.invoke('netdoctor:connect'),
 diagnose:(mode,access,scenario)=>ipcRenderer.invoke('netdoctor:diagnose',mode,access,scenario),
 explain:(runId)=>ipcRenderer.invoke("netdoctor:explain",runId),
 save:(format,report)=>ipcRenderer.invoke('netdoctor:save',format,report)
}));
