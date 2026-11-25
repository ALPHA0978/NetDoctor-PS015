import assert from 'node:assert/strict';
import {test} from 'node:test';
import {faultTitle,matchesChallenge,pickFault,supportNote} from '../src/challenge.ts';
import {newFixture} from '../src/diagnostics.ts';
const makeCase=(id:string)=>({id,title:id,description:id});
test('blind selector is restricted to supported controlled cases and includes ambiguous',()=>{
 const available=['healthy','control','gateway','ambiguous','offline'].map(makeCase);
 assert.equal(pickFault(available,()=>0),'gateway');
 assert.equal(pickFault(available,()=>0.99),'ambiguous');
 assert.equal(pickFault([makeCase('control')]),null);
 assert.throws(()=>pickFault(available,()=>1));
 assert.match(faultTitle('ambiguous'),/insufficient/i);
});
test('blind run refuses substituted fixtures, wrong scenarios or live responses',()=>{
 const f=newFixture('gateway','unknown');
 assert.equal(matchesChallenge(f,'gateway'),false);
 assert.equal(matchesChallenge({...f,source:'controlled-loopback'},'dns'),false);
 assert.equal(matchesChallenge({...f,source:'controlled-loopback',mode:'live'},'gateway'),false);
 assert.equal(matchesChallenge({...f,source:'controlled-loopback'},'gateway'),true);
});
test('support note keeps lab scope, verdict, evidence, clean retest and safe next step in order',()=>{
 const f={...newFixture('gateway','ethernet'),source:'controlled-loopback' as const};
 const c={...newFixture('gateway','ethernet'),source:'controlled-loopback' as const,scenario:'control'};
 c.measurements[0].value=5;
 const note=supportNote(c,f);
 const tags=['INITIAL VERDICT','DECIDING EVIDENCE','RETEST','SAFE NEXT STEP','SCOPE AND LIMITATIONS'];
 for(let i=1;i<tags.length;i++)assert.ok(note.indexOf(tags[i])>note.indexOf(tags[i-1]));
 assert.match(note,/not a household recovery/);
 assert.match(note,/Gateway replies: 0 to 5/);
 assert.ok(note.includes(f.actions[0]));
});
test('support note from fixture without retest clearly describes the unmeasured source',()=>{
 const note=supportNote(newFixture('congestion','unknown'),null);
 assert.match(note,/No household network was measured/);
 assert.match(note,/No retest recorded yet/);
});

