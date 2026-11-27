'use strict';

const DIAG_ALARM = 'tabDiagnostic';
const DIAG_RESULT = 'lastTabDiagnostic';
let capture;

function duration(start,end) {
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start ? Math.round(end-start) : null;
}

function requestTimings(row) {
  const timing=row.timing || {};
  const headers=timing.receiveHeadersStart >= 0 ? timing.receiveHeadersStart : timing.receiveHeadersEnd;
  const tls=duration(timing.sslStart,timing.sslEnd);
  const connect=duration(timing.connectStart,timing.connectEnd);
  return {
    total:duration(row.start*1000,row.end*1000),
    dns:duration(timing.dnsStart,timing.dnsEnd),
    tcp:connect === null ? null : Math.max(0,connect-(tls ?? 0)),
    tls,
    wait:duration(timing.sendEnd,headers),
    download:duration(row.headersAt*1000,row.end*1000)
  };
}

function recordRequest(session,method,event) {
  if (method==='Network.requestWillBeSent') {
    if (session.rows.size>=200 || !/^https?:\/\//.test(event.request.url)) return;
    // Keep only origin and resource type. Paths, headers, bodies and queries are discarded.
    session.rows.set(event.requestId,{origin:new URL(event.request.url).origin,type:event.type || 'Request',start:event.timestamp});
    return;
  }
  const row=session.rows.get(event.requestId);
  if (!row) return;
  if (method==='Network.responseReceived') {
    row.headersAt=event.timestamp;
    row.timing=event.response.fromDiskCache || event.response.fromServiceWorker ? null : event.response.timing;
    row.status=event.response.status;
  } else if (method==='Network.loadingFinished' || method==='Network.loadingFailed') {
    row.end=event.timestamp;
    row.failed=(method==='Network.loadingFailed' && !event.canceled) || row.status>=400;
  }
}

function summarizeCapture(session) {
  const completed=[...session.rows.values()].filter(row=>Number.isFinite(row.end));
  const slowest=completed.map(row=>({origin:row.origin,type:row.type,status:row.status,failed:row.failed,...requestTimings(row)}))
    .sort((a,b)=>b.total-a.total);
  return { origin:session.origin, observed:session.rows.size, pending:session.rows.size-completed.length, failed:completed.filter(row=>row.failed).length,
    requests:slowest.slice(0,5) };
}

async function pageMetrics(target) {
  try {
    const {metrics}=await chrome.debugger.sendCommand(target,'Performance.getMetrics');
    return Object.fromEntries(metrics.map(({name,value})=>[name,value]));
  } catch { return {}; }
}

async function stopDiagnostic(detached=false) {
  if (!capture) return (await chrome.storage.session.get(DIAG_RESULT))[DIAG_RESULT];
  const session=capture;
  capture=null;
  await chrome.alarms.clear(DIAG_ALARM);
  const result=summarizeCapture(session);
  if (!detached) {
    const target={tabId:session.tabId};
    const end=await pageMetrics(target);
    const start=session.startMetrics;
    if (Number.isFinite(start?.NavigationStart) && start.NavigationStart===end.NavigationStart &&
        Number.isFinite(start.TaskDuration) && end.TaskDuration>=start.TaskDuration) {
      result.mainThreadMs=Math.round((end.TaskDuration-start.TaskDuration)*1000);
    }
    await chrome.debugger.detach(target).catch(()=>{});
  }
  await chrome.storage.session.set({[DIAG_RESULT]:result});
  return result;
}

async function startDiagnostic(tabId) {
  if (capture) throw Error('A tab diagnostic is already running.');
  if (!Number.isInteger(tabId)) throw Error('Select a website tab.');
  const tab=await chrome.tabs.get(tabId);
  if (!tab.active || !isPage(tab)) throw Error('Open the website you want to diagnose.');
  if ((await read())?.limited.includes(tabId)) throw Error('Restore this tab’s bandwidth before diagnosing it.');
  const target={tabId};
  await chrome.debugger.attach(target,'1.3');
  try {
    capture={tabId,origin:new URL(tab.url).origin,rows:new Map()};
    await chrome.debugger.sendCommand(target,'Network.enable');
    await chrome.debugger.sendCommand(target,'Performance.enable').catch(()=>{});
    capture.startMetrics=await pageMetrics(target);
    await chrome.alarms.create(DIAG_ALARM,{delayInMinutes:0.5});
    await chrome.storage.session.remove(DIAG_RESULT);
  } catch (error) {
    capture=null;
    await chrome.debugger.detach(target).catch(()=>{});
    throw error;
  }
}

chrome.debugger.onEvent.addListener((target,method,event)=>{
  if (capture?.tabId===target.tabId) recordRequest(capture,method,event);
});
chrome.debugger.onDetach.addListener(target=>{
  if (capture?.tabId===target.tabId) enqueue(()=>stopDiagnostic(true)).catch(()=>{});
});
chrome.alarms.onAlarm.addListener(alarm=>{
  if (alarm.name===DIAG_ALARM) enqueue(()=>stopDiagnostic()).catch(()=>{});
});
