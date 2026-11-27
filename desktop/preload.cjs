const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('netdoctor',Object.freeze({
 connect:()=>ipcRenderer.invoke('netdoctor:connect'),
 network:(selected)=>ipcRenderer.invoke('netdoctor:network',selected??null),
 reverseDns:(address)=>ipcRenderer.invoke('netdoctor:reverse-dns',address),
 checkDestination:(appName,address,port)=>ipcRenderer.invoke('netdoctor:check-destination',appName,address,port),
 diagnose:(mode,access,scenario)=>ipcRenderer.invoke('netdoctor:diagnose',mode,access,scenario),
 explain:(runId)=>ipcRenderer.invoke("netdoctor:explain",runId),
 save:(format,report)=>ipcRenderer.invoke('netdoctor:save',format,report)
}));
