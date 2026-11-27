'use strict';

const $ = id => document.getElementById(id);
const picked = () => [...$('competitors').querySelectorAll('input:checked')].map(input => Number(input.value));
let priority;
let busy = false;
let diagnosticBusy = false;
let recording = false;
let currentTab;
const phases = [['dns','DNS'],['tcp','Connection'],['tls','TLS'],['wait','Response wait'],['download','Download']];

function renderDiagnostic(reply) {
  recording = Boolean(reply.capturing);
  const toggle=$('diagnostic-toggle');
  toggle.textContent=recording?'Stop and show results':'Diagnose this tab';
  toggle.disabled=diagnosticBusy || (!recording && !currentTab);
  const results=$('diagnostic-results');
  results.replaceChildren();
  $('diagnostic-status').textContent=recording
    ? 'Recording for up to 30 seconds. Close this menu and reproduce the slowdown, then reopen it.'
    : 'Record requests while reproducing the slowdown.';
  if (!reply.result) return;
  const {origin,observed,failed,pending,requests,mainThreadMs}=reply.result;
  $('diagnostic-status').textContent=observed
    ? origin+' · '+observed+' requests observed · '+failed+' failed · '+pending+' unfinished'
    : 'No requests were captured. Start again, then reload or repeat the slow action.';
  const list=document.createElement('ol');
  for (const row of requests) {
    const item=document.createElement('li');
    const measured=phases.filter(([key])=>row[key] != null).sort(([a],[b])=>row[b]-row[a]);
    const slowest=measured[0];
    const title=document.createElement('strong');
    title.textContent=row.type+' · '+row.origin+' · '+row.total+' ms'+(row.failed?' · failed':row.status?' · HTTP '+row.status:'');
    const detail=document.createElement('p');
    detail.textContent=slowest
      ? 'Longest measured phase: '+slowest[1]+' ('+row[slowest[0]]+' ms). '+measured.map(([key,label])=>label+' '+row[key]+' ms').join(' · ')
      : 'Phase timings unavailable for this request.';
    item.append(title,detail);
    list.append(item);
  }
  if (requests.length) results.append(list);
  if (mainThreadMs != null) {
    const load=document.createElement('p');
    load.textContent='Main-thread tasks took '+mainThreadMs+' ms during capture.';
    results.append(load);
  }
}

async function refreshDiagnostic() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  currentTab=/^https?:\/\//.test(tab?.url || '')?tab.id:null;
  renderDiagnostic(await request({type:'diagnostic-status'}));
}

$('diagnostic-toggle').addEventListener('click',async()=>{
  if (diagnosticBusy || (!recording && !currentTab)) return;
  diagnosticBusy=true;
  $('diagnostic-toggle').disabled=true;
  try {
    await request(recording?{type:'diagnostic-stop'}:{type:'diagnostic-start',tabId:currentTab});
    diagnosticBusy=false;
    await refreshDiagnostic();
  } catch (error) {
    diagnosticBusy=false;
    $('diagnostic-toggle').disabled=!recording && !currentTab;
    $('diagnostic-status').textContent=error.message;
  }
});
refreshDiagnostic().catch(error=>{$('diagnostic-status').textContent=error.message;});

function updateButton() {
  const count = picked().length;
  $('start').disabled = busy || !priority || !count || count > 12;
}

async function request(message) {
  const reply = await chrome.runtime.sendMessage(message);
  if (reply?.error) throw Error(reply.error);
  return reply;
}

async function render(state) {
  $('setup').hidden = Boolean(state);
  $('active').hidden = !state;
  if (state) {
    const tab = await chrome.tabs.get(state.priority).catch(() => null);
    $('active-title').textContent = tab?.title || 'Priority tab';
    $('summary').textContent = state.limited.length + ' tabs limited to ' + state.mbps + ' Mbps each.';
    return;
  }
  const tabs = (await chrome.tabs.query({ currentWindow: true })).filter(tab => /^https?:\/\//.test(tab.url || ''));
  priority = tabs.find(tab => tab.active);
  $('priority-title').textContent = priority?.title || 'Open a website to select a priority tab.';
  const choices = tabs.filter(tab => tab.id !== priority?.id);
  $('competitors').replaceChildren(...choices.map(tab => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = tab.id;
    label.append(input, document.createTextNode(tab.title || 'Untitled tab'));
    return label;
  }));
  if (!choices.length) $('competitors').textContent = 'No other website tabs in this window.';
  updateButton();
}

async function change(message) {
  if (busy) return;
  busy = true;
  updateButton();
  $('stop').disabled = true;
  $('status').textContent = message.type === 'start' ? 'Applying limits…' : 'Restoring tabs…';
  try {
    const reply = await request(message);
    await render(reply.state);
    $('status').textContent = reply.skipped ? reply.skipped + ' selected tabs could not be limited.' : '';
  } catch (error) {
    $('status').textContent = error.message;
    const reply = await request({ type: 'status' }).catch(() => null);
    if (reply) await render(reply.state);
  } finally {
    busy = false;
    $('stop').disabled = false;
    updateButton();
  }
}

$('competitors').addEventListener('change', () => {
  $('status').textContent = picked().length > 12 ? 'Choose up to 12 tabs.' : '';
  updateButton();
});
$('start').addEventListener('click', () => change({
  type: 'start', priority: priority.id, competitors: picked(), mbps: Number($('limit').value)
}));
$('stop').addEventListener('click', () => change({ type: 'stop' }));
request({ type: 'status' }).then(reply => render(reply.state)).catch(error => { $('status').textContent = error.message; });
