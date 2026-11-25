const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const path=require('node:path');
const {api,diagnoseDesktop,exportReport,simulate}=require('./diagnostics.cjs');

test('Android transport reads measured results from the actual Python loopback lab', {timeout:30000}, async (t)=>{
  const child=spawn(process.env.NETDOCTOR_PYTHON||'python',
    ['-B',path.resolve(__dirname,'../backend/server.py'),'--host','127.0.0.1','--port','0'],
    {windowsHide:true,stdio:['ignore','pipe','pipe']});
  let errorOutput='';
  child.stderr.on('data',x=>{errorOutput+=x;});
  t.after(async()=>{
    if(child.exitCode!==null||child.signalCode!==null)return;
    const exiting=once(child,'exit').catch(()=>{});
    child.kill();
    await exiting;
  });
  const base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Python API did not start: '+errorOutput)),5000);
    const done=value=>{clearTimeout(timer);resolve(value);};
    const fail=err=>{clearTimeout(timer);reject(err);};
    let out='';
    child.stdout.on('data',chunk=>{
      out+=chunk;
      const ready=out.match(/http:\/\/127\.0\.0\.1:\d+/);
      if(ready)done(ready[0]);
    });
    child.once('error',fail);
    child.once('exit',code=>fail(new Error('Python API exited '+code+': '+errorOutput)));
  });
  assert.equal((await api(base,'/health')).status,'ok');
  const available=await api(base,'/scenarios');
  const expectations={gateway:'gateway_unreachable',dns:'dns',packet_loss:'packet_loss',congestion:'congestion',ambiguous:'inconclusive',control:'healthy'};
  let first=null;let control=null;let ambiguous=null;
  for(const [scenario,code] of Object.entries(expectations)){
    assert.ok(available.find(row=>row.id===scenario));
    const r=await diagnoseDesktop(base,{kind:'lab',scenario});
    assert.equal(r.diagnosis.code,code);
    assert.equal(r.provenance.source,'controlled-loopback');
    assert.ok(r.measurements.length>=5);
    if(scenario==='packet_loss')first=r;
    if(scenario==='control')control=r;
    if(scenario==='ambiguous')ambiguous=r;
  }
  const rows=new Map(ambiguous.measurements.map(row=>[row.id,row]));
  assert.equal(rows.get('gateway').value,null);
  assert.equal(rows.get('gateway').status,'fail');
  assert.equal(rows.get('dns').status,'fail');
  assert.match(rows.get('dns').detail,/servfail/i);
  assert.equal(rows.get('loss').value,0);
  assert.match(rows.get('loss').detail,/10\/10 numbered datagrams returned/);
  assert.match(JSON.parse(exportReport(ambiguous)).scope,/Measured desktop lab/);
  const synthetic=simulate('ambiguous');
  assert.equal(JSON.parse(exportReport(synthetic,ambiguous)).comparison,undefined);
  assert.match(JSON.parse(exportReport(synthetic)).scope,/Synthetic controlled example/);
  const evidence=JSON.parse(exportReport(control,first));
  assert.equal(evidence.comparison.kind,'fault-to-clean-control');
  assert.equal(evidence.comparison.metrics.find(m=>m.id==='loss').after,0);
  assert.doesNotMatch(JSON.stringify(evidence),/127\.0\.0\.1/);
});
