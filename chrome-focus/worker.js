'use strict';

const KEY = 'tabPriority';
const DURATION_MINUTES = 15;
const LIMITS = [0.5, 1, 2];
let queue = Promise.resolve();

function enqueue(task) {
  const work = queue.then(task);
  queue = work.catch(() => {});
  return work;
}

const read = async () => (await chrome.storage.session.get(KEY))[KEY];
const save = state => chrome.storage.session.set({ [KEY]: state });
const isPage = tab => /^https?:\/\//.test(tab?.url || '');
importScripts('tab-diagnostics.js');

async function detach(tabId) {
  await chrome.debugger.sendCommand({ tabId }, 'Network.emulateNetworkConditionsByRule', {
    matchedNetworkConditions: []
  }).catch(() => {});
  try {
    await chrome.debugger.detach({ tabId });
    return true;
  } catch {
    // If there is no attached target, Chrome has already removed the rules.
    return !(await chrome.debugger.getTargets()).some(target => target.tabId === tabId && target.attached);
  }
}

async function stop() {
  const state = await read();
  if (!state) return;
  const remaining = [];
  for (const tabId of state.limited) {
    if (!await detach(tabId)) remaining.push(tabId);
  }
  if (remaining.length) {
    await save({ ...state, limited: remaining });
    throw Error('Some limits are still active. Try Stop again or close the affected tabs.');
  }
  await chrome.storage.session.remove(KEY);
  await chrome.alarms.clear(KEY);
}

async function start({ priority, competitors, mbps }) {
  if (!Number.isInteger(priority) || !Array.isArray(competitors) || !competitors.length ||
      competitors.length > 12 || competitors.some(id => !Number.isInteger(id) || id === priority) ||
      !LIMITS.includes(mbps)) throw Error('Choose a priority tab and up to 12 other tabs.');
  const target = await chrome.tabs.get(priority);
  if (!isPage(target) || !target.active) throw Error('Open the tab you want to prioritize and reopen this menu.');
  await stop();
  const state = { priority, limited: [], mbps };
  await save(state);
  await chrome.alarms.create(KEY, { delayInMinutes: DURATION_MINUTES });
  let skipped = 0;
  for (const tabId of new Set(competitors)) {
    let attached = false;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!isPage(tab) || tab.windowId !== target.windowId) { skipped++; continue; }
      await chrome.debugger.attach({ tabId }, '1.3');
      attached = true;
      state.limited.push(tabId);
      await save(state);
      const throughput = mbps * 1e6 / 8;
      await chrome.debugger.sendCommand({ tabId }, 'Network.emulateNetworkConditionsByRule', {
        matchedNetworkConditions: [{
          urlPattern: '', latency: 0, downloadThroughput: throughput, uploadThroughput: throughput
        }]
      });
    } catch {
      skipped++;
      if (attached) {
        if (!await detach(tabId)) {
          throw Error('Chrome could not confirm a tab’s limit. Use Stop to release the attached tabs.');
        }
        state.limited = state.limited.filter(id => id !== tabId);
        await save(state);
      }
    }
  }
  if (!state.limited.length) {
    await stop();
    throw Error('Chrome could not apply limits to the selected tabs.');
  }
  return { state, skipped };
}

async function dispatch(message) {
  if (message?.type === 'status') return { state: await read() };
  if (message?.type === 'start') return start(message);
  if (message?.type === 'stop') { await stop(); return {}; }
  if (message?.type === 'diagnostic-status') return { capturing:!!capture, result:(await chrome.storage.session.get(DIAG_RESULT))[DIAG_RESULT] };
  if (message?.type === 'diagnostic-start') { await startDiagnostic(message.tabId); return {capturing:true}; }
  if (message?.type === 'diagnostic-stop') return {result:await stopDiagnostic()};
  throw Error('Unknown action.');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.url !== chrome.runtime.getURL('popup.html')) return false;
  enqueue(() => dispatch(message)).then(sendResponse, error => sendResponse({ error: error.message }));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === KEY) enqueue(stop).catch(() => {});
});
chrome.tabs.onRemoved.addListener(tabId => {
  enqueue(async () => { if ((await read())?.priority === tabId) await stop(); }).catch(() => {});
});
chrome.debugger.onDetach.addListener(({ tabId }) => {
  enqueue(async () => {
    const state = await read();
    if (!state?.limited.includes(tabId)) return;
    if ((await chrome.debugger.getTargets()).some(target => target.tabId === tabId && target.attached)) return;
    state.limited = state.limited.filter(id => id !== tabId);
    if (state.limited.length) await save(state);
    else await stop();
  }).catch(() => {});
});
