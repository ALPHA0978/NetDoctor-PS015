import assert from 'node:assert/strict';
import {parseReport,readScenarios,output} from '../src/diagnostics.ts';
const base='http://127.0.0.1:8765';
const headers={origin:'http://127.0.0.1:3000','content-type':'application/json'};
const health=await fetch(base+'/health',{headers});assert.equal(health.status,200);assert.equal(health.headers.get('access-control-allow-origin'),headers.origin);
const options=await fetch(base+'/diagnose',{method:'OPTIONS',headers:{origin:headers.origin,'access-control-request-method':'POST','access-control-request-headers':'content-type'}});assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),headers.origin);
const rows=readScenarios(await (await fetch(base+'/scenarios',{headers})).json());
assert.ok(rows.length>=5);
for(const id of ['gateway','dns','packet_loss','congestion','control']){
 assert.ok(rows.some(x=>x.id===id),'Missing '+id);
 const res=await fetch(base+'/diagnose',{method:'POST',headers,body:JSON.stringify({mode:'demo',scenario:id,access:'unknown'})});
 assert.equal(res.status,200);
 const report=parseReport(await res.json(),'demo');
 assert.equal(report.scenario,id);assert.equal(report.source,'controlled-loopback');assert.ok(report.measurements.length);assert.ok(report.limitations.length);
 assert.equal(JSON.parse(output(report)).source,'controlled-loopback');
 console.log(id,report.diagnosis.code,report.measurements.length+' observations');
}
if(process.argv.includes('--live')){
 const res=await fetch(base+'/diagnose',{method:'POST',headers,body:JSON.stringify({mode:'live',access:'unknown'})});
 assert.equal(res.status,200);
 const report=parseReport(await res.json(),'live');
 assert.equal(report.mode,'live');assert.notEqual(report.source,'controlled-loopback');assert.ok(report.limitations.length);
 console.log('Measured live:',report.diagnosis.code,report.measurements.length+' observations.');
}

