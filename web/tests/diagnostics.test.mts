import assert from 'node:assert/strict';
import { test } from 'node:test';
import {compareMeasurements,newFixture,output,parseReport,readHistory,readScenarios,safeCollector,scenarios,updateHistory} from '../src/diagnostics.ts';

test('all built-in scenarios work offline without claiming measurement',()=>{
 for(const s of scenarios){const r=newFixture(s.id,'unknown'); assert.equal(r.mode,'demo'); assert.equal(r.source,'offline-fixture'); assert.equal(r.scenario,s.id); assert.ok(r.evidence.length);assert.ok(r.actions.length);assert.ok(r.limitations.some(x=>x.includes('No traffic')));assert.ok(r.measurements.length);}
});
test('lookalike public domains and collector credentials are refused',()=>{
 for(const host of ['https://example.com','http://localhost.evil.test:8765','http://user@localhost:8765','file://localhost/path','http://127.0.0.1:8765/danger','http://localhost:8765/?x=y']) assert.throws(()=>safeCollector(host));
 for(const host of ['http://localhost:8765','http://127.0.0.1:8765','http://192.168.1.15:8765','http://172.17.2.1:8765']) assert.equal(safeCollector(host),host);
});
test('live failures cannot become fixture results even when mislabeled',()=>{
 const r=newFixture('dns','unknown'); assert.throws(()=>parseReport(r,'live'));
 assert.throws(()=>parseReport({...r,mode:'live'},'live'));
 assert.throws(()=>parseReport({...r,mode:'live',source:'collector',provenance:{source:'controlled-loopback'}},'live'));
});
test('controlled lab provenance is preserved through local history and JSON export',()=>{
 const fixture=newFixture('gateway','unknown');
 const {source:_,...shape}=fixture;
 const controlled=parseReport({...shape,provenance:{source:'controlled-loopback'}});
 assert.equal(controlled.source,'controlled-loopback');
 const saved=readHistory(JSON.stringify([controlled]));
 assert.equal(saved[0].source,'controlled-loopback');
 const exported=JSON.parse(output(controlled));assert.equal(exported.source,'controlled-loopback');assert.equal(exported.mode,'demo');
});
test('report export strips unrecognized fields, including raw addresses',()=>{
 const r=newFixture('wifi','unknown');const data={...r,rawIp:'192.0.2.1',diagnosis:{...r.diagnosis,token:'private'},measurements:r.measurements.map(x=>({...x,address:'192.0.2.2'}))};
 const exported=output(parseReport(data));
 assert.doesNotMatch(exported,/192\.0\.2|private|rawIp/);
});
test('history rejects malformed rows, is bounded, and deduplicates',()=>{
 const h=Array.from({length:24},()=>newFixture('dns','wifi'));
 assert.deepEqual(readHistory('bad-json'),[]);
 assert.equal(readHistory(JSON.stringify([null,h[0],{...h[1],created_at:'not a date'}])).length,1);
 assert.equal(updateHistory(h,h[1]).length,16);
 assert.equal(updateHistory(h,h[1]).filter(x=>x.id===h[1].id).length,1);
});
test('retest deltas only compare matching mode, scenario, source, access, ids and units',()=>{
 const a=newFixture('congestion','ethernet');const b=newFixture('congestion','ethernet');
 b.measurements[1].value=160;
 assert.equal(compareMeasurements(a,b)[1].before,194); assert.equal(compareMeasurements(a,b)[1].after,160);
 assert.equal(compareMeasurements(a,{...b,access:'wifi'}).length,0);
 assert.equal(compareMeasurements(a,{...b,source:'controlled-loopback'}).length,0);
 assert.equal(compareMeasurements(a,newFixture('gateway','ethernet')).length,0);
 assert.equal(compareMeasurements(a,{...b,measurements:b.measurements.map(m=>({...m,unit:'?'}))}).length,0);
});
test('collector scenario metadata accepts bundled or direct response and drops invalid records',()=>{
 assert.deepEqual(readScenarios({scenarios:[scenarios[0],null,{id:1,title:'x',description:'x'}]}),[scenarios[0]]);
 assert.deepEqual(readScenarios('not a list'),[]);
});


test('only measured fault to clean-control supports a cross-scenario comparison',()=>{
 const off=newFixture('congestion','ethernet');
 const before={...off,source:'controlled-loopback' as const};
 const after={...before,scenario:'control',measurements:before.measurements.map(m=>({...m,value:typeof m.value==='number'?m.value/2:m.value}))};
 assert.ok(compareMeasurements(before,after).length>0);
 assert.equal(compareMeasurements(before,{...after,scenario:'dns'}).length,0);
 assert.equal(compareMeasurements(off,{...after,source:'offline-fixture'}).length,0);
});
