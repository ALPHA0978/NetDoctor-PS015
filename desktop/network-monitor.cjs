'use strict';
const { execFile } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { createConnection, isIP } = require('node:net');
const { performance } = require('node:perf_hooks');
const execute = promisify(execFile);

function medium(type) {
  if (type === 'Wireless80211') return 'Wi-Fi';
  if (/Ethernet/.test(type)) return 'Ethernet';
  if (type === 'Wwanpp' || type === 'Wwanpp2' || type === '243' || type === '244') return 'Cellular';
  if (type === 'Tunnel' || type === 'Ppp') return 'Tunnel / PPP';
  return 'Other adapter';
}

function summarizeConnections(connections) {
  if (!Array.isArray(connections)) return null;
  const apps = new Map();
  const peers = new Map();
  let privateCount = 0;
  for (const { app, address } of connections) {
    // Private/link-local ranges describe address scope. A public peer can still be on a LAN.
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|f[cd][\da-f]{2}:|fe[89ab][\da-f]:)/i.test(address)) privateCount++;
    const label = app || 'Unknown process';
    apps.set(label, (apps.get(label) || 0) + 1);
    peers.set(address, (peers.get(address) || 0) + 1);
  }
  const top = entries => [...entries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
  return { apps: top(apps), peers: top(peers), privateCount, publicCount: connections.length - privateCount };
}

function buildAppMap(data, baseline, selected) {
  if (!Array.isArray(data.connections)) return null;
  const apps = new Map();
  const interval = data.tcpSampledAt - baseline?.tcpSampledAt;
  const sameRoute = data.id === baseline?.id && data.address === baseline?.address &&
    data.networkName === baseline?.networkName && data.gateways.join() === baseline?.gateways.join();
  const comparable = sameRoute && selected && selected === baseline?.selected && interval >= 500 && interval <= 20000;
  const prior = comparable ? new Map(baseline.connections?.map(row => [row.key, row])) : new Map();
  if (data.chromeRunning) apps.set('chrome', { name: 'chrome', count: 0, measured: 0, destinations: [] });
  const groups = new Map();

  for (const connection of data.connections) {
    const { app, address, port, key, received, sent } = connection;
    const name = app?.toLowerCase() || 'unknown process';
    if (!apps.has(name)) apps.set(name, { name, count: 0, measured: 0, destinations: [] });
    const group = apps.get(name);
    const destinationKey = JSON.stringify([name, address, port]);
    if (!groups.has(destinationKey)) {
      const destination = { address, port, count: 0, measured: 0, received: 0, sent: 0 };
      group.destinations.push(destination);
      groups.set(destinationKey, destination);
    }
    const destination = groups.get(destinationKey);
    group.count++;
    destination.count++;
    const before = prior.get(key);
    if (name !== selected || ![received, sent, before?.received, before?.sent].every(Number.isSafeInteger) ||
        received < before.received || sent < before.sent || before.app?.toLowerCase() !== name) continue;
    group.measured++;
    destination.measured++;
    destination.received += received - before.received;
    destination.sent += sent - before.sent;
    if ([connection.segmentsIn, connection.segmentsOut, before.segmentsIn, before.segmentsOut].every(Number.isSafeInteger) &&
        connection.segmentsIn >= before.segmentsIn && connection.segmentsOut >= before.segmentsOut) {
      destination.segmentCoverage = (destination.segmentCoverage || 0) + 1;
      destination.segmentsIn = (destination.segmentsIn || 0) + connection.segmentsIn - before.segmentsIn;
      destination.segmentsOut = (destination.segmentsOut || 0) + connection.segmentsOut - before.segmentsOut;
    }
  }
  return { apps: [...apps.values()].sort((a,b) => b.count - a.count || a.name.localeCompare(b.name)),
    state: data.trafficStatus, selected, interval: comparable ? interval : null };
}

let pending;
let baseline;
let observed;
let observedAt=0;
let checkingDestination=false;
async function snapshot(selected = null) {
  if (process.platform !== 'win32') return { state: 'unsupported' };
  if (pending) {
    if (pending.selected === selected) return pending.promise;
    await pending.promise;
    return snapshot(selected);
  }
  const promise = readSnapshot(selected).then(result=>{
    observed=result.map;
    observedAt=Date.now();
    return result;
  }).finally(() => { pending = null; });
  pending = { selected, promise };
  return promise;
}

async function readSnapshot(selected) {
  try {
    const script = readFileSync(path.join(__dirname, 'network-snapshot.ps1'), 'utf8');
    const command = Buffer.from(script, 'utf16le').toString('base64');
    const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const { stdout } = await execute(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', command],
      { windowsHide: true, timeout: 8000, maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, NETDOCTOR_TCP_APP: selected || '', NETDOCTOR_TCP_SOURCE: path.join(__dirname, 'tcp-counters.cs') } });
    const data = JSON.parse(stdout);
    if (data.state !== 'connected') {
      baseline = null;
      return { state: data.state };
    }
    const { connections, type, trafficStatus, tcpSampledAt, chromeRunning, ...adapter } = data;
    const map = buildAppMap(data, baseline, selected);
    baseline = selected && trafficStatus === 'sampling' ? { ...data, selected } : null;
    return { ...adapter, medium: medium(type), usage: summarizeConnections(connections), map };
  } catch {
    baseline = null;
    return { state: 'unavailable' };
  }
}

async function checkDestination(app,address,port) {
  if (typeof address!=='string' || !isIP(address) || address.includes('%') ||
      !Number.isInteger(port) || port<1 || port>65535 ||
      Date.now()-observedAt>15000 ||
      !observed?.apps.find(item=>item.name===app)?.destinations.some(row=>row.address===address&&row.port===port)) {
    throw Error('This destination is no longer in the latest Network map. Wait for a fresh sample.');
  }
  if (checkingDestination) throw Error('A destination check is already running.');
  checkingDestination=true;
  try {
    return await new Promise(resolve=>{
      const started=performance.now();
      const socket=createConnection({host:address,port});
      const deadline=setTimeout(()=>finish('timeout'),3000);
      function finish(status) {
        clearTimeout(deadline);
        socket.destroy();
        resolve({status,elapsed:Math.round(performance.now()-started)});
      }
      socket.once('connect',()=>finish('connected'));
      socket.once('error',error=>finish(error.code==='ECONNREFUSED'?'refused':'unreachable'));
    });
  } finally {
    checkingDestination=false;
  }
}

module.exports = { snapshot, buildAppMap, checkDestination };
