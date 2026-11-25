const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./model');
test('offline fixtures preserve explicit source and never emit live claims',()=>{
 const codes=new Set();
 for(const example of M.scenarios){
  const result=M.makeDemo(example.id,'wifi');
  assert.equal(result.mode,'demo');
  assert.match(result.limitations.join(' '),/synthetic|fabricated|controlled|fixture|simulated/i);
  assert.ok(result.measurements.length>=5);
  codes.add(result.diagnosis.code);
 }
 assert.ok(codes.size>=5);
 assert.throws(()=>M.makeDemo('bad','unknown'),/valid/);
});
test('matched retests and unobserved metrics cannot imply improvement',()=>{
 const a=M.makeDemo('wifi','wifi'), b=M.makeDemo('wifi','wifi');
 assert.ok(M.compare(a,b).length>=3);
 assert.ok(M.compare(a,b).every(d=>d.delta===0));
 assert.deepEqual(M.compare(a,M.makeDemo('healthy','wifi')),[]);
 assert.deepEqual(M.compare({...a,mode:'live'},b),[]);
 const incomplete=M.makeDemo('mixed','unknown');
 assert.ok(M.compare(incomplete,incomplete).length<incomplete.measurements.length);
});
test('redacted HTML export escapes markup and drops unknown fields',()=>{
 const r=M.makeDemo('healthy','wifi');
 r.raw={'ssid':'Private'};
 r.evidence=['bad <img src=x onerror=alert(1)> at 192.168.0.1','Contact user@example.com'];
 const clean=M.normalize(r);
 const html=M.html(r);
 assert.equal(clean.raw,undefined);
 assert.doesNotMatch(html,/192\.168\.0\.1|user@example\.com|<img/);
 assert.match(html,/&lt;img/);
 assert.match(html,/CONTROLLED DEMO/);
});
test('normalizer distinguishes unknown, false, and a real zero',()=>{
 const r=M.makeDemo('healthy','ethernet');
 r.measurements[0].value=false;r.measurements[1].value=0;r.measurements[2].value=null;
 assert.deepEqual(M.normalize(r).measurements.slice(0,3).map(m=>m.value),[false,0,null]);
 assert.throws(()=>M.normalize({...r,mode:'wrong'}),/Invalid report/);
});
