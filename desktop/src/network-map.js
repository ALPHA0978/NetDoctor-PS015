'use strict';
(() => {
 const dash = '—';
 const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
 const labels = new Map([['chrome', 'Google Chrome'], ['msedge', 'Microsoft Edge'], ['firefox', 'Mozilla Firefox']]);
 const name = app => labels.get(app) || app;
 const rate = (bytes, elapsed) => {
  const mbps = bytes * 8 / (elapsed * 1000);
  return mbps > 0 && mbps < 0.1 ? number.format(mbps * 1000) + ' kbps' : number.format(mbps) + ' Mbps';
 };
 const volume = bytes => bytes >= 1e6 ? number.format(bytes / 1e6) + ' MB'
  : bytes >= 1000 ? number.format(bytes / 1000) + ' KB' : number.format(bytes) + ' B';

 function mount({ element, refresh, lookupDomain, checkDestination }) {
  const $ = id => document.getElementById(id);
  const set = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
  const picker = $('map-app');
  const measure = $('map-measure');
  const graph = $('map-graph');
  const destinationList = $('map-destinations');
  const filter = $('map-destination-filter');
  const trafficHeadings = document.querySelectorAll('.map-traffic-column');
  const lookups = new Map();
  const nameKey = 'netdoctor.destination-names';
  const namesDialog = $('map-name-dialog');
  const nameInput = $('map-custom-name');
  let aliases = new Map();
  try { aliases = new Map(JSON.parse(localStorage.getItem(nameKey) || '[]')); }catch{}
  let editingAddress;
  let sample;
  let adapterTraffic;
  let active = false;
  let measuring = false;
  let freshMeasurement = false;
  let selected = '';
  let optionNames = '';
  let destinationRows = '';
  let drawnGraph = '';
  let visibleAddresses = [];
  let lookupScheduled = false;
  let automaticLookups = 0;
  let probeBusy = false;
  let probeTarget;

  async function probeDestination(row, appName = selected) {
   if (probeBusy) return;
   probeBusy=true;
   probeTarget={row,appName};
   const result=$('map-probe-result');
   const speed=value=>Number.isFinite(value)?number.format(value)+' Mbps':dash;
   const displayName=destinationName(row.address);
   set('map-probe-target',[name(appName),displayName,endpoint(row)].filter(Boolean).join(' · '));
   set('map-probe-time',dash);
   set('map-probe-rx',speed(adapterTraffic?.rx));
   set('map-probe-tx',speed(adapterTraffic?.tx));
   result.hidden=false;
   result.dataset.state='checking';
   $('map-probe-icon').setAttribute('href','#i-pulse');
   set('map-probe-status','Checking TCP…');
   set('map-probe-next','Waiting for the destination to accept a new TCP connection.');
   $('map-probe-retry').disabled=true;
   $('map-probe-close').disabled=true;
   if (location.hash==='#diagnostics') $('map-probe-title').focus();
   else location.hash='diagnostics';
   try {
    const report=await checkDestination(appName,row.address,row.port);
    const outcome={
     connected:['TCP connected','If the app is still slow, investigate service response time or transfer speed.'],
     refused:['Connection refused','Check whether the service accepts new connections on this port.'],
     timeout:['Connection timed out','Retest while the app is slow and compare with another network.'],
     unreachable:['Destination unreachable','Check the active route and confirm the service is reachable.']
    };
    const [status,next]=outcome[report.status] || ['Measurement unavailable','Wait for a fresh Network map sample, then retest.'];
    result.dataset.state=report.status==='connected'?'connected':'failed';
    $('map-probe-icon').setAttribute('href',report.status==='connected'?'#i-check':'#i-info');
    set('map-probe-status',status);
    set('map-probe-time',Number.isFinite(report.elapsed)?number.format(report.elapsed)+' ms':dash);
    set('map-probe-next',next);
   } catch(error) {
    result.dataset.state='failed';
    $('map-probe-icon').setAttribute('href','#i-info');
    set('map-probe-status','Check unavailable');
    set('map-probe-next',String(error?.message || 'Wait for a fresh sample, then retest.').replace(/^Error invoking remote method '[^']+': (Error: )?/,''));
   } finally {
    probeBusy=false;
    $('map-probe-retry').disabled=false;
    $('map-probe-close').disabled=false;
   }
  }

  $('map-probe-retry').addEventListener('click',()=>{
   if(probeTarget)probeDestination(probeTarget.row,probeTarget.appName);
  });
  $('map-probe-close').addEventListener('click',()=>{
   const trigger=[...destinationList.querySelectorAll('[data-probe-endpoint]')].find(button=>
    probeTarget?.appName===selected && button.dataset.probeEndpoint===endpoint(probeTarget.row));
   $('map-probe-result').hidden=true;
   probeTarget=null;
   if(location.hash==='#diagnostics')location.hash='network-map';
   (trigger || $('map-detail-title')).focus();
  });

  const endpoint = row => (row.address.includes(':') ? '[' + row.address + ']' : row.address) + ':' + row.port;
  const segmentLabel = (incoming, outgoing) => number.format(incoming) + ' in / ' + number.format(outgoing) + ' out';
  const hasSegments = row => row.segmentCoverage > 0 && row.segmentCoverage === row.measured;
  const connectionsLabel = count => number.format(count) + (count === 1 ? ' TCP connection' : ' TCP connections');
  const hostname = address => lookups.get(address)?.names?.[0];
  const destinationName = address => aliases.get(address) || hostname(address);

  function editName(address) {
   if (namesDialog.open) return;
   editingAddress = address;
   nameInput.value = aliases.get(address) || '';
   set('map-name-address',address);
   set('map-name-error','');
   $('map-name-remove').hidden = !aliases.has(address);
   namesDialog.showModal();
  }

  function saveName(value) {
   const updated = new Map(aliases);
   if (value) updated.set(editingAddress,value);
   else updated.delete(editingAddress);
   try { localStorage.setItem(nameKey,JSON.stringify([...updated])); }
   catch { set('map-name-error','NetDoctor could not save the name on this device.'); return; }
   aliases = updated;
   namesDialog.close();
   render();
  }

  $('map-name-form').addEventListener('submit',event=>{
   event.preventDefault();
   const value=nameInput.value.trim();
   if(value)saveName(value);
   else set('map-name-error','Enter a display name.');
  });
  $('map-name-remove').addEventListener('click',()=>saveName(''));
  $('map-name-cancel').addEventListener('click',()=>namesDialog.close());

  function scheduleVisibleLookups() {
   if (!lookupDomain || lookupScheduled) return;
   lookupScheduled = true;
   queueMicrotask(() => {
    lookupScheduled = false;
    if (!active) return;
    for (const address of visibleAddresses) {
     if (automaticLookups >= 3) break;
     if (lookups.has(address)) continue;
     automaticLookups++;
     resolveDomain(address).finally(() => {
      automaticLookups--;
      scheduleVisibleLookups();
     });
    }
   });
  }

  async function resolveDomain(address) {
   if (!lookupDomain || lookups.get(address)?.state === 'pending') return;
   lookups.set(address, { state: 'pending' });
   render();
   try {
    lookups.set(address, await lookupDomain(address));
   } catch {
    lookups.set(address, { state: 'unavailable' });
   }
   render();
  }

  function domainCell(row) {
   const cell = element('td', null, 'map-domain-cell');
   const alias = aliases.get(row.address);
   const nameButton = element('button',alias?'Edit name':'Set name');
   nameButton.type = 'button';
   nameButton.dataset.endpoint = endpoint(row);
   nameButton.dataset.destinationName = '';
   nameButton.setAttribute('aria-label',nameButton.textContent+' for '+row.address);
   nameButton.addEventListener('click',()=>editName(row.address));
   if(alias)cell.append(element('strong',alias,'map-custom-label'));
   cell.append(nameButton);
   if(checkDestination){
    const check=element('button','Diagnose');
    check.type='button';
    check.className='map-diagnose-action';
    check.dataset.probeEndpoint=endpoint(row);
    check.setAttribute('aria-label','Diagnose '+endpoint(row));
    check.addEventListener('click',()=>probeDestination(row));
    cell.append(check);
   }
   const result = lookups.get(row.address);
   const statusText = {
    pending: 'Looking up…',
    missing: 'No hostname published',
    unavailable: 'Lookup unavailable'
   };
   const status = element('span', result?.state === 'found' ? result.names.join(', ') : statusText[result?.state]);
   status.setAttribute('role', 'status');
   if (['pending', 'found', 'missing'].includes(result?.state) || !lookupDomain) {
    cell.append(status);
    if (!lookupDomain) status.textContent = dash;
    status.tabIndex = -1;
    status.dataset.endpoint = endpoint(row);
    return cell;
   }
   const button = element('button', result?.state === 'unavailable' ? 'Retry lookup' : 'Look up domain');
   button.type = 'button';
   button.dataset.endpoint = endpoint(row);
   button.setAttribute('aria-label', button.textContent + ' for ' + row.address);
   button.addEventListener('click', () => resolveDomain(row.address));
   cell.append(button, status);
   return cell;
  }
  const svg = (tag, attributes, text) => {
   const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
   for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
   if (text !== undefined) node.textContent = text;
   return node;
  };

  function drawGraph(apps, validSample, connected) {
   const visible = apps.slice(0, 4);
   const choice = apps.find(app => app.name === selected);
   if (choice && !visible.includes(choice)) visible[visible.length - 1] = choice;
   const groups = visible.map(app => {
    const ranked = [...app.destinations].sort((a, b) => b.count - a.count);
    const limit = selected === app.name ? 3 : 2;
    const rows = ranked.slice(0, limit);
    const other = ranked.slice(limit);
    if (other.length) rows.push({
     other: other.length,
     count: other.reduce((total, row) => total + row.count, 0)
    });
    return { app, rows };
   });
   visibleAddresses = [...new Set(groups.flatMap(group => group.rows.filter(row => !row.other).map(row => row.address)))];
   scheduleVisibleLookups();
   const signature = JSON.stringify([groups, visibleAddresses.map(destinationName), selected, validSample, connected, sample?.address, sample?.gateways, sample?.medium, adapterTraffic]);
   if (signature === drawnGraph) return;
   drawnGraph = signature;
   const focused = document.activeElement?.dataset.app;
   const focusedDestination = document.activeElement?.dataset.destinationKey;
   const nodes = [];
   const links = [];
   let y = 65;
   for (const group of groups) {
    group.rowY = group.rows.map((_, index) => y + index * 59);
    group.center = group.rowY.length ? (y + group.rowY.at(-1)) / 2 : y;
    y += Math.max(1, group.rows.length) * 59 + 8;
   }
   const height = Math.max(235, y - 17);
   const center = height / 2;
   graph.setAttribute('viewBox', '0 0 980 ' + height);
   graph.setAttribute('width', 980);
   graph.setAttribute('height', height);

   function node(x, cy, width, icon, title, detail, style = '', action, address) {
    const group = svg('g', { transform: 'translate(' + x + ' ' + (cy - 24) + ')', class: 'topology-node ' + style });
    const titleLimit = width >= 230 ? 35 : 20;
    const shorten = (value, max) => value.length > max ? value.slice(0, max - 1) + '…' : value;
    group.append(svg('title', {}, [title, address, detail].filter(Boolean).join(' · ')),
     svg('rect', { width, height: 48, rx: 9 }),
     svg('use', { href: '#i-' + icon, x: 11, y: 13, width: 20, height: 20, class: 'icon' }),
     svg('text', { x: 39, y: address ? 15 : 20, class: 'topology-title' }, shorten(title, titleLimit)),
     svg('text', { x: 39, y: address ? 41 : 36, class: 'topology-detail' }, shorten(detail, titleLimit + 5)));
    if(address)group.append(svg('text', { x: 39, y: 28, class: 'topology-detail' }, shorten(address, titleLimit + 5)));
    if (action) {
     group.setAttribute('role', 'button');
     group.setAttribute('tabindex', '0');
     group.setAttribute('aria-label', 'Inspect ' + title + ', ' + detail);
     group.setAttribute('aria-pressed', String(action === selected));
     group.dataset.app = action;
    }
    nodes.push(group);
   }
   const link = (x1, y1, x2, y2, style) => {
    const middle = (x1 + x2) / 2;
    links.push(svg('path', { d: `M${x1} ${y1} C${middle} ${y1} ${middle} ${y2} ${x2} ${y2} m-6 -3 l6 3 -6 3`,
     class: 'topology-link ' + style }));
   };
   node(14, center, 163, 'router', 'Network device', connected ? sample.gateways[0] || 'Gateway unavailable' : 'Awaiting route');
   node(353, center, 176, 'device', 'This PC', connected ? sample.medium + ' · ' + sample.address : 'No active adapter', 'topology-focus');
   link(177, center - 9, 353, center - 9, 'topology-in');
   links.push(svg('path', { d: `M353 ${center + 9} H177 m6 -3 l-6 3 6 3`, class: 'topology-link topology-out' }));
   for (const [field, label, offset, cls] of [
    ['packetsIn', 'RX', -16, 'topology-in'], ['packetsOut', 'TX', 26, 'topology-out']
   ]) {
    const count = adapterTraffic?.[field];
    const speed = adapterTraffic ? number.format(adapterTraffic[field === 'packetsIn' ? 'rx' : 'tx']) + ' Mbps' : dash;
    const text = Number.isSafeInteger(count) ? number.format(count) + ' packets · ' + speed : speed;
    nodes.push(svg('text', { x: 265, y: center + offset, 'text-anchor': 'middle', class: 'topology-count ' + cls },
     label + ' ' + text));
   }
   for (const { app, rows, rowY, center: appY } of groups) {
    const isSelected = selected === app.name;
    const measured = isSelected && validSample;
    link(529, center, 590, appY, isSelected ? 'topology-highlight' : '');
    node(590, appY, 153, 'layers', name(app.name), connectionsLabel(app.count), isSelected ? 'topology-focus' : '', app.name);
    rows.forEach((row, i) => {
     link(743, appY, 778, rowY[i], isSelected ? 'topology-highlight' : '');
     const detail = connectionsLabel(row.count);
     const host = row.other ? '' : destinationName(row.address);
     node(778, rowY[i], 188, row.other ? 'layers' : 'cloud',
      row.other ? 'Other destinations' : host || endpoint(row), detail, row.other ? 'topology-other' : '',
      undefined, host ? endpoint(row) : undefined);
     const hint = row.other ? number.format(row.other) + ' additional IP and port pairs'
      : measured && hasSegments(row) ? segmentLabel(row.segmentsIn, row.segmentsOut) + ' segments' : '';
     if (hint) nodes.at(-1).querySelector('title').textContent += ' · ' + hint;
     if(!row.other){
      const destination=nodes.at(-1);
      destination.dataset.destinationAddress=row.address;
      destination.dataset.destinationKey=app.name+'|'+endpoint(row);
      destination.setAttribute('role','button');
      destination.setAttribute('tabindex','0');
      destination.setAttribute('aria-label','Set display name for '+endpoint(row));
     }
    });
   }
   if (!groups.length) node(590, center, 376, 'layers', 'No apps to show', 'Waiting for established TCP connections');
   graph.replaceChildren(...links, ...nodes);
   if (focused) [...graph.querySelectorAll('[data-app]')].find(node => node.dataset.app === focused)?.focus();
   if (focusedDestination) [...graph.querySelectorAll('[data-destination-key]')]
    .find(node => node.dataset.destinationKey === focusedDestination)?.focus({preventScroll:true});
  }

  function render() {
   if (!active) return;
   const connected = sample?.state === 'connected';
   const map = sample?.map;
   const apps = map?.apps || [];
   const names = apps.map(app => app.name).sort((a, b) => name(a).localeCompare(name(b)));
   if (map && selected && !names.includes(selected)) names.push(selected);
   if (!selected) selected = names.includes('chrome') ? 'chrome' : apps[0]?.name || '';
   const choiceKey = JSON.stringify(names);
   if (choiceKey !== optionNames) {
    optionNames = choiceKey;
    picker.replaceChildren(...(names.length ? names : ['']).map(app => {
     const option = element('option', app ? name(app) : 'No apps available');
     option.value = app;
     return option;
    }));
   }
   picker.value = selected;
   picker.disabled = !names.length;
   const requiresAdmin = map?.state === 'requires-admin';
   measure.disabled = !measuring && (!map || !selected || selected === 'unknown process' || requiresAdmin);

   const app = apps.find(entry => entry.name === selected);
   const destinations = app?.destinations || [];
   const count = app?.count || 0;
   const validSample = measuring && freshMeasurement && map?.selected === selected && map?.interval > 0 && app?.measured > 0;
   const state = freshMeasurement && map?.selected === selected && map?.state;
   const activity = {
    'requires-admin': 'Close NetDoctor and reopen it with Run as administrator to measure per-app traffic.',
    unavailable: 'Windows TCP counters are unavailable.',
    sampling: count === 0 ? 'No established TCP connections for this app.'
     : map?.interval ? 'Waiting for a TCP connection that stays open across two samples.' : 'Taking the first two TCP samples…'
   };
   set('map-route-status', connected ? [sample.networkName || sample.name, sample.medium].filter(Boolean).join(' · ')
    : sample?.state === 'disconnected' ? 'Windows could not select an Internet route.'
     : sample ? 'Windows network readings are unavailable.' : 'Waiting for Windows network readings.');
   drawGraph(apps, validSample, connected);
   set('map-app-status', map && names.length ? '· ' + names.length : '');
   set('map-graph-scope', apps.length ? (apps.length > 4 ? 'Showing 4 of ' + apps.length + ' apps · ' : '') + 'Select an app branch to inspect it.' : 'Apps appear when Windows reports TCP connections.');
   $('map-app-summary').hidden = !map || !selected;
   set('map-connection-count', number.format(count));
   set('map-destination-count', number.format(destinations.length));
   set('map-app-name', selected ? name(selected) : 'App traffic');
   set('map-ai-context', app?.count
    ? name(selected) + ' has ' + connectionsLabel(app.count) + ' across ' + number.format(destinations.length)
     + (destinations.length === 1 ? ' destination.' : ' destinations.') + ' Use TCP traffic measurements to compare bandwidth.'
    : 'Select an app with active TCP connections to see its destination totals.');
   set('map-measure', measuring ? 'Stop measurement' : requiresAdmin ? 'Administrator required' : 'Measure TCP traffic');
   const message = requiresAdmin ? activity['requires-admin'] : validSample
    ? 'Latest sample · ' + number.format(map.interval / 1000) + ' s'
    : measuring ? (activity[state] || 'Waiting for Windows TCP counters.')
     : !sample ? 'Waiting for Windows network readings.'
      : !map ? 'App connections are unavailable.'
       : !selected ? 'Waiting for an app with TCP connections.' : '';
   set('map-traffic-status', message);
   $('map-notice').hidden = !message;
   $('map-notice').dataset.state = requiresAdmin ? 'restricted' : validSample ? 'live' : 'waiting';
   const showTraffic = measuring && !requiresAdmin;
   $('map-metrics').hidden = !showTraffic;
   for (const heading of trafficHeadings) heading.hidden = !showTraffic;
   const received = validSample ? destinations.reduce((sum, row) => sum + row.received, 0) : null;
   const sent = validSample ? destinations.reduce((sum, row) => sum + row.sent, 0) : null;
   set('map-rx', validSample ? rate(received, map.interval) : dash);
   set('map-tx', validSample ? rate(sent, map.interval) : dash);
   set('map-bytes', validSample ? volume(received + sent) : dash);
   set('map-covered', validSample ? app.measured + ' of ' + count : dash);

   const query = filter.value.trim().toLowerCase();
   const rows = destinations.filter(row => !query || endpoint(row).toLowerCase().includes(query) ||
    aliases.get(row.address)?.toLowerCase().includes(query) ||
    lookups.get(row.address)?.names?.some(host => host.toLowerCase().includes(query)))
    .sort((a, b) => b.count - a.count || a.address.localeCompare(b.address) || a.port - b.port);
   const emptyMessage = !map ? 'Destination readings are unavailable.' : query ? 'No destinations match your filter.' : 'No established TCP destinations.';
   filter.disabled = !destinations.length && !query;
   set('map-destination-status', query ? rows.length + ' of ' + destinations.length + ' destinations'
    : validSample && destinations.some(row => !row.measured) ? 'Dashes indicate destinations without a matching traffic sample.'
     : 'Established TCP connections');
   const rendered = JSON.stringify([rows, emptyMessage, showTraffic, Boolean(validSample), validSample ? map.interval : null,
    rows.map(row => [lookups.get(row.address),aliases.get(row.address)])]);
   if (rendered === destinationRows) return;
   destinationRows = rendered;
   const emptyRow = element('tr');
   const emptyCell = element('td', emptyMessage, 'map-empty');
   emptyCell.colSpan = showTraffic ? 7 : 3;
   emptyRow.append(emptyCell);
   const focusEndpoint = destinationList.contains(document.activeElement) ? document.activeElement.dataset.endpoint : null;
   const focusNameButton = focusEndpoint && document.activeElement.hasAttribute('data-destination-name');
   destinationList.replaceChildren(...(rows.length ? rows.map(row => {
    const tr = element('tr');
    const measured = validSample && row.measured > 0;
    tr.append(element('td', endpoint(row), 'map-endpoint'), domainCell(row), element('td', row.count));
    if (showTraffic) for (const label of [measured ? rate(row.received, map.interval) : dash,
     measured ? rate(row.sent, map.interval) : dash,
     measured && hasSegments(row) ? segmentLabel(row.segmentsIn, row.segmentsOut) : dash,
     measured ? volume(row.received + row.sent) : dash]) {
     tr.append(element('td', label));
    }
    return tr;
   }) : [emptyRow]));
   if (focusEndpoint) {
    [...destinationList.querySelectorAll('[data-endpoint]')].find(node =>
     node.dataset.endpoint === focusEndpoint && node.hasAttribute('data-destination-name') === focusNameButton)?.focus({preventScroll:true});
   }
  }

  function choose(app) {
   if (app === selected) return;
   selected = app;
   filter.value = '';
   freshMeasurement = false;
   render();
   if (measuring) refresh();
  }
  picker.addEventListener('change', () => choose(picker.value));
  filter.addEventListener('input', render);
  $('map-jump').addEventListener('click', () => $('map-detail-title').focus());
  graph.addEventListener('click', event => {
   const address = event.target.closest('[data-destination-address]')?.dataset.destinationAddress;
   if(address){editName(address);return;}
   const app = event.target.closest('[data-app]')?.dataset.app;
   if (app) choose(app);
  });
  graph.addEventListener('keydown', event => {
   const {app,destinationAddress}=event.target.dataset;
   if ((event.key === 'Enter' || event.key === ' ') && (app||destinationAddress)) {
    event.preventDefault();
    if(destinationAddress)editName(destinationAddress);
    else choose(app);
   }
  });
  measure.addEventListener('click', () => {
   measuring = !measuring;
   freshMeasurement = false;
   render();
   refresh();
  });
  return {
   focusDiagnostic() {
    if ($('map-probe-result').hidden) return false;
    $('map-probe-title').focus();
    return true;
   },
   apply(value, traffic) {
    sample = value;
    adapterTraffic = traffic;
    freshMeasurement = measuring && value.map?.selected === selected;
    render();
   },
   open(value) {
    active = value;
    if (!active) {
     measuring = false;
     freshMeasurement = false;
    }
    render();
   },
   measurementApp() { return active && measuring && selected !== 'unknown process' ? selected || null : null; }
  };
 }

 window.NetDoctorMap = { mount };
})();
