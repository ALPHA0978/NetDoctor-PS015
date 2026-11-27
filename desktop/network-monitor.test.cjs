'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAppMap } = require('./network-monitor.cjs');

test('TCP usage aggregates matching socket deltas and excludes new or reset sockets', () => {
  const route = { id: 'wifi', address: '192.0.2.15', gateways: ['192.0.2.1'], trafficStatus: 'sampling' };
  const row = { app: 'chrome', address: '203.0.113.7', port: 443 };
  const before = { ...route, selected: 'chrome', tcpSampledAt: 1000, connections: [
    { ...row, key: 'first', received: 500, sent: 100, segmentsIn: 10, segmentsOut: 5 },
    { ...row, key: 'reset', received: 400, sent: 200 }
  ] };
  const after = { ...route, tcpSampledAt: 5000, connections: [
    { ...row, key: 'first', received: 1500, sent: 300, segmentsIn: 32, segmentsOut: 11 },
    { ...row, key: 'new', received: 8000, sent: 5000 },
    { ...row, key: 'reset', received: 0, sent: 0 }
  ] };
  const map = buildAppMap(after, before, 'chrome');
  assert.equal(map.interval, 4000);
  assert.equal(map.apps[0].measured, 1);
  assert.deepEqual(map.apps[0].destinations, [
    { address: row.address, port: 443, count: 3, measured: 1, received: 1000, sent: 200,
      segmentCoverage: 1, segmentsIn: 22, segmentsOut: 6 }
  ]);
  assert.equal(buildAppMap({ ...after, id: 'ethernet' }, before, 'chrome').apps[0].measured, 0);
});
