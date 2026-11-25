const test=require('node:test');
const assert=require('node:assert/strict');
const {EXAMPLES,simulate,sanitize,fromDevice,hostUrl,api,diagnoseDesktop,comparable,difference,exportReport}=require('./diagnostics.cjs');

test('all controlled scenarios preserve their source, metrics and remediation',()=>{
  for(const {id} of EXAMPLES){
    const raw=simulate(id,'wifi');
    const r=sanitize(raw);
    assert.equal(r.mode,'demo');
    assert.equal(r.scenario,id);
    assert.ok(r.evidence.length);
    assert.ok(r.actions.length);
    assert.ok(r.measurements.length>1);
    assert.match(r.limitations[0],/Not live/);
  }
  assert.throws(()=>simulate('never-existed'),/Select/);
});

test('Android snapshot reports private, bounded observations and preserves unknown',()=>{
  const r=sanitize(fromDevice({type:'WIFI',isConnected:true,isInternetReachable:null,ipAddress:'192.168.1.13',ssid:'Home Network'}));
  assert.equal(r.access,'wifi');
  assert.equal(r.measurements[2].value,'Unknown');
  const json=exportReport(r);
  assert.doesNotMatch(json,/192\.168|Home Network|ipAddress/);
  assert.match(json,/This phone: connection status only/);
});

test('measured lab results cannot be mistaken for offline examples or saved as live',async()=>{
  const demo=simulate('dns','unknown');
  const measured={...demo,provenance:{source:'controlled-loopback'}};
  const fake=(data)=>async()=>({ok:true,json:async()=>data});
  const base='http://127.0.0.1:8765';
  const lab=await diagnoseDesktop(base,{kind:'lab',scenario:'dns'},fake(measured));
  assert.equal(lab.provenance.source,'controlled-loopback');
  assert.match(exportReport(lab),/Measured desktop lab on controlled loopback/);
  assert.equal(comparable(demo,{...lab,id:'another-id'}),false);
  assert.ok(comparable(lab,{...lab,id:'another-id'}));
  await assert.rejects(diagnoseDesktop(base,{kind:'lab',scenario:'dns'},fake(demo)),/measured result/);
  await assert.rejects(diagnoseDesktop(base,{kind:'lab',scenario:'gateway'},fake(measured)),/measured result/);
  await assert.rejects(diagnoseDesktop(base,{kind:'live'},fake(measured)),/not return a live result/);
});

test('private probe tracking prevents cross-host comparisons and does not export IDs',()=>{
  const lab={...simulate('dns'),provenance:{source:'controlled-loopback'},probeSerial:'probe-123-aaaa'};
  const same={...lab,id:'next'};
  const different={...same,probeSerial:'probe-123-bbbb'};
  assert.equal(comparable(lab,different),false);
  assert.equal(JSON.parse(exportReport(different,lab)).comparison,undefined);
  const json=exportReport(same,lab);
  assert.ok(JSON.parse(json).comparison);
  assert.doesNotMatch(json,/probe-123/);
});

test('retests only compare compatible sources and metrics',()=>{
  const base=simulate('wifi','wifi',new Date(0));
  const again=simulate('wifi','wifi',new Date(1000));
  assert.ok(comparable(base,again));
  assert.ok(difference(base,again).every(row=>row.delta===0));
  assert.deepEqual(difference(base,{...again,access:'ethernet'}),[]);
  assert.deepEqual(difference(base,simulate('healthy','wifi')),[]);
  assert.deepEqual(difference(base,{...again,mode:'live'}),[]);
  assert.deepEqual(difference(base,base),[]);
  const lower=structuredClone(again); lower.measurements[0].value=10;
  assert.equal(JSON.parse(exportReport(lower,base)).comparison.metrics[0].delta,-105);
});

test('evidence projection discards extras and scrubs known network identifiers',()=>{
  const r=simulate('wifi','wifi');
  r.target='should-never-export';
  r.evidence=['IP 192.168.0.11 and IPv6 2001:db8::7; http://192.168.1.1/path; BSSID: 00:aa:11:22:33:44; Alice@example.com'];
  r.measurements[0].debug='secret-token';
  const json=exportReport(r);
  assert.doesNotMatch(json,/should-never-export|secret-token|192\.168|2001:db8|00:aa:11|Alice@example/);
  assert.throws(()=>exportReport({...r,mode:'unverified'}),/verified/);
});

test('only well-formed local origins can be entered',()=>{
  for(const addr of ['http://192.168.0.3:8765/','http://172.31.2.1','http://10.0.2.2:8765','https://localhost:4000']){
    assert.equal(hostUrl(addr),addr.replace(/\/$/,''));
  }
  for(const addr of ['https://openai.com','http://172.32.0.1','http://10.300.1.0','http://010.0.0.1','http://127.0.0.1:70000','http://192.168.1.2@evil.com','http://192.168.0.2/path','file:///','']){
    assert.throws(()=>hostUrl(addr));
  }
});

test('desktop transport posts only mode and access and rejects redirect, never invents data',async()=>{
  let last;
  const request=async (url,init)=>{last={url,init};return {ok:true,json:async()=>({mode:'live'})};};
  const r=await api('http://192.168.1.3:8765','/diagnose',{mode:'live',access:'ethernet'},request);
  assert.equal(r.mode,'live');
  assert.equal(last.url,'http://192.168.1.3:8765/diagnose');
  assert.equal(last.init.redirect,'error');
  assert.deepEqual(JSON.parse(last.init.body),{mode:'live',access:'ethernet'});
  await assert.rejects(api('http://192.168.1.3:8765','/health',null,async()=>({ok:true,redirected:true})),/redirected/);
  await assert.rejects(api('http://192.168.1.3:8765','/health',null,async()=>({ok:false,status:500})),/HTTP 500/);
});
