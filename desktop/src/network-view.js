'use strict';
(() => {
 const WINDOW_MS = 5 * 60 * 1000;
 const SAMPLE_DELAY = 3000;
 const FIRST_TCP_RECHECK = 650;
 const DASH = '—';
 const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
 const rate = value => Number.isFinite(value) ? format.format(value) + ' Mbps' : DASH;
 const total = value => format.format(value / 1e6) + ' MB';
 function checkMetrics(report) {
  const metrics = new Map(report?.measurements.map(row => [row.id, row]) || []);
  return [
   ['latency', ['latency'], 'ms'], ['loss', ['loss'], '%'],
   ['dns', ['dns_1', 'dns_2'], 'ms'], ['https', ['https_1', 'https_2'], 'ms']
  ].map(([label, ids, unit]) => {
   const values = ids.map(id => metrics.get(id)?.value).filter(Number.isFinite);
   const average = values.reduce((sum, value) => sum + value, 0) / values.length;
   return [label, values.length ? format.format(average) + ' ' + unit : DASH];
  });
 }

 function mount({ read, measurementApp, element, onRouteChange, onSample, onChecks }) {
  const $ = id => document.getElementById(id);
  const set = (id, value) => {
   const node = $(id);
   if (node.textContent !== value) node.textContent = value;
  };
  let current, points = [];
  const canvas = $('traffic-chart');
  const range = $('traffic-range');
  const usageView = $('usage-view');
  let routeStatus = 'Detecting the active Windows route…';
  let verdict;

  function paint() {
   const width = canvas.clientWidth;
   const height = canvas.clientHeight;
   if (width < 100 || height < 50) return;
   const ctx = canvas.getContext('2d');
   if (!ctx) return;
   const ratio = window.devicePixelRatio || 1;
   canvas.width = Math.round(width * ratio);
   canvas.height = Math.round(height * ratio);
   ctx.scale(ratio, ratio);
   const colors = getComputedStyle(canvas);
   const receiveColor = colors.getPropertyValue('--receive');
   const sendColor = colors.getPropertyValue('--send');
   const left = 48, right = width - 7, top = 9, bottom = height - 24;
   const end = current?.sampledAt || 0;
   const windowMs = Number(range.value);
   const visible = points.filter(p => p.end >= end - windowMs);
   const peak = Math.max(0.01, ...visible.map(p => Math.max(p.rx, p.tx)));
   const magnitude = 10 ** Math.floor(Math.log10(peak));
   const max = Math.ceil(peak / magnitude) * magnitude;
   ctx.font = '11px Segoe UI, sans-serif';
   ctx.textAlign = 'right';
   ctx.textBaseline = 'middle';
   for (let i = 0; i <= 4; i++) {
    const y = top + (bottom - top) * i / 4;
    ctx.strokeStyle = colors.getPropertyValue('--line');
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.fillStyle = colors.getPropertyValue('--muted');
    ctx.fillText(format.format(max * (1 - i / 4)), left - 6, y);
   }
   ctx.textAlign = 'left'; ctx.fillText(windowMs === WINDOW_MS ? '5 min ago' : '1 min ago', left, height - 9);
   ctx.textAlign = 'center'; ctx.fillText(windowMs === WINDOW_MS ? '2m 30s ago' : '30s ago', (left + right) / 2, height - 9);
   ctx.textAlign = 'right'; ctx.fillText('Now', right, height - 9);
   for (const [field, color] of [['rx', receiveColor], ['tx', sendColor]]) {
    const area = ctx.createLinearGradient(0, top, 0, bottom);
    area.addColorStop(0, color.trim() + '52');
    area.addColorStop(1, color.trim() + '04');
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < visible.length; i++) {
     const point = visible[i];
     const x = right - (end - point.end) * (right - left) / windowMs;
     const y = bottom - point[field] * (bottom - top) / max;
     const previous = visible[i - 1];
     ctx.beginPath();
     if (previous && previous.end === point.start) {
      const priorX = right - (end - previous.end) * (right - left) / windowMs;
      const priorY = bottom - previous[field] * (bottom - top) / max;
      ctx.fillStyle = area;
      ctx.moveTo(priorX, bottom);
      ctx.lineTo(priorX, priorY);
      ctx.lineTo(x, y);
      ctx.lineTo(x, bottom);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(priorX, priorY);
      ctx.lineTo(x, y); ctx.stroke();
     } else {
      ctx.fillStyle = color;
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI); ctx.fill();
     }
    }
   }
  }

  function list(id, rows) {
   const values = rows?.length ? rows : [[rows ? 'No active connections' : 'Unavailable', '']];
   const target = $(id);
   const key = JSON.stringify(values);
   if (target.dataset.rows === key) return;
   target.dataset.rows = key;
   target.replaceChildren(...values.map(([label, count]) => {
    const item = element('li');
    item.append(element('span', label), element('strong', String(count)));
    return item;
   }));
  }

  function showHealth() {
   const healthy = verdict?.diagnosis.code === 'healthy';
   const state = verdict ? (healthy ? 'healthy' : 'review') : 'pending';
   $('health-icon').dataset.health = state;
   $('health-symbol').setAttribute('href', healthy ? '#i-check' : verdict ? '#i-info' : '#i-pulse');
   set('title', healthy ? 'Your network is healthy' : verdict?.diagnosis.title || 'Network overview');
   set('network-status', verdict?.diagnosis.summary || routeStatus);
   set('recommendation', verdict?.actions[0] || 'Run a live diagnostic to see next steps.');
  }

  function showChecks(report) {
   verdict = report;
   showHealth();
   onChecks(report);
   for (const [label, value] of checkMetrics(report)) set('network-' + label, value);
  }

  function showUsage(usage) {
   const count = usage ? usage.privateCount + usage.publicCount : 0;
   const local = count > 0 ? 100 * usage.privateCount / count : 0;
   $('usage-other').setAttribute('stroke-dasharray', count > 0 ? '100 0' : '0 100');
   $('usage-private').setAttribute('stroke-dasharray', local + ' ' + (100 - local));
   set('usage-count', usage ? String(count) : DASH);
   set('usage-private-label', usage ? 'Private / link-local · ' + usage.privateCount : 'Private / link-local');
   set('usage-other-label', usage ? 'Other destinations · ' + usage.publicCount : 'Other destinations');
   list('network-apps', usage?.apps);
   list('network-peers', usage?.peers);
  }

  function showTraffic() {
   let received = 0, sent = 0;
   const windowStart = (current?.sampledAt || 0) - Number(range.value);
   const visible = points.filter(point => point.end > windowStart);
   for (const point of visible) {
    const fraction = (point.end - Math.max(windowStart, point.start)) / (point.end - point.start);
    received += point.received * fraction;
    sent += point.sent * fraction;
   }
   set('traffic-total', visible.length ? 'Sampled totals: ' + total(received) + ' received · ' + total(sent) + ' sent' : 'Totals appear as samples arrive.');
   paint();
  }

  function apply(sample) {
   const previous = current;
   current = sample.state === 'connected' ? sample : undefined;
   const sameRoute = previous && current && previous.id === current.id && previous.address === current.address &&
    previous.gateways.join() === current.gateways.join() && previous.networkName === current.networkName;
   if (sameRoute && previous.sampledAt === current.sampledAt) return;
   if (!sameRoute) {
    points = [];
    if (previous || current) {
     showChecks(null);
     onRouteChange();
    }
   }
   let latest;
   if (sameRoute) {
    const interval = current.sampledAt - previous.sampledAt;
    if (interval >= 500 && interval <= 20000 &&
        [current.received, previous.received, current.sent, previous.sent].every(Number.isSafeInteger)) {
     const received = current.received - previous.received;
     const sent = current.sent - previous.sent;
     if (received >= 0 && sent >= 0) {
      latest = { start: previous.sampledAt, end: current.sampledAt, received, sent,
       rx: received * 8 / (interval * 1000), tx: sent * 8 / (interval * 1000) };
      for (const field of ['packetsIn', 'packetsOut']) {
       if ([current[field], previous[field]].every(Number.isSafeInteger) && current[field] >= previous[field]) {
        latest[field] = current[field] - previous[field];
       }
      }
      points.push(latest);
     } else {
      points = [];
     }
    }
    points = points.filter(point => point.end >= current.sampledAt - WINDOW_MS);
   }
   onSample(sample, latest);
   const usage = current?.usage;
   const messages = {
    connected: 'Showing the interface Windows selects for the Internet route.',
    disconnected: 'Windows could not select an Internet route.',
    unavailable: 'Windows adapter readings are temporarily unavailable.',
    unsupported: 'Live adapter readings require the NetDoctor Windows desktop app.'
   };
   routeStatus = messages[sample.state] || messages.unavailable;
   showHealth();
   $('network-dot').toggleAttribute('data-connected', Boolean(current));
   $('network-diagram').toggleAttribute('data-connected', Boolean(current));
   set('network-live-label', current ? 'Live' : sample.state === 'disconnected' ? 'Disconnected' : 'Unavailable');
   set('network-name', current?.networkName || current?.name || (sample.state === 'disconnected' ? 'No active route' : 'Unavailable'));
   set('network-family', current ? (current.address.includes(':') ? 'IPv6 route selected' : 'IPv4 route selected') : 'No route reading');
   set('network-medium', current?.medium || DASH);
   set('flow-medium', current?.medium || DASH);
   set('network-ip', current?.address || DASH);
   set('network-link', current?.linkSpeed ? rate(current.linkSpeed / 1e6) : DASH);
   set('network-gateway', current ? current.gateways.join(', ') || 'No gateway reported' : DASH);
   set('flow-apps', usage ? (usage.apps.length >= 6 ? 'See top apps below' : usage.apps.length + ' process groups') : DASH);
   set('flow-private', usage ? usage.privateCount + ' TCP connections' : DASH);
   set('flow-public', usage ? usage.publicCount + ' TCP connections' : DASH);
   set('network-rx', rate(latest?.rx));
   set('network-tx', rate(latest?.tx));
   set('header-rx', rate(latest?.rx));
   set('header-tx', rate(latest?.tx));
   set('traffic-status', latest ? 'Measured receive and send rates in Mbps' : current ? 'Waiting for consecutive adapter counters' : 'No adapter counters available');
   showUsage(usage);
   set('auto-access', current ? 'Auto-detect · ' + current.medium : 'Auto-detect active connection');
   showTraffic();
  }

  let sampling, samplingApp, timer;
  async function refresh() {
   if (!read) return;
   const selected = measurementApp();
   if (sampling) {
    const changed = selected !== samplingApp;
    await sampling;
    return changed ? refresh() : current?.medium;
   }
   clearTimeout(timer);
   samplingApp = selected;
   let nextDelay = SAMPLE_DELAY;
   sampling = Promise.resolve().then(() => read(selected)).then(sample => {
    apply(sample);
    if (selected && selected === measurementApp() && sample.map?.state === 'sampling' && sample.map.interval == null) {
     nextDelay = FIRST_TCP_RECHECK;
    }
   }).catch(() => apply({ state: 'unavailable' })).finally(() => {
    sampling = null;
    timer = setTimeout(refresh, nextDelay);
   });
   await sampling;
   return current?.medium;
  }

  range.addEventListener('change', () => {
   canvas.setAttribute('aria-label', 'Receive and send throughput · ' + range.selectedOptions[0].textContent);
   showTraffic();
  });
  usageView.addEventListener('change', () => {
   $('network-apps').hidden = usageView.value !== 'apps';
   $('network-peers').hidden = usageView.value !== 'peers';
  });
  if (window.ResizeObserver) {
   new ResizeObserver(paint).observe(canvas.parentElement);
   new MutationObserver(paint).observe(document.documentElement, { attributeFilter: ['data-theme'] });
  }
  if (read) refresh();
  else apply({ state: 'unsupported' });
  return { refresh, showChecks };
 }

 window.NetDoctorNetwork = { mount, checkMetrics, rate };
})();
