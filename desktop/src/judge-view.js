'use strict';
(function(){
 const verdicts={gateway_unreachable:'Local gateway check failed',dns:'Name-resolution evidence points to DNS',packet_loss:'Packet delivery was unreliable',congestion:'Latency increased under load',inconclusive:'Inconclusive: no single cause isolated',healthy:'No issue observed in this sample'};
 const cases=['gateway','dns','packet_loss','congestion','ambiguous','control'];
 function shuffled(){
  const a=[...cases], n=new Uint32Array(1);
  for(let i=a.length-1;i>0;i--){
   const limit=2**32-(2**32%(i+1));
   do{crypto.getRandomValues(n)}while(n[0]>=limit);
   const j=n[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];
  }
  return a;
 }
 function mount(board,{app,element:el,save,commit}){
  let order=[], hidden=null, revealed=null, after=null, working=false, message='', card=null, active=false;
  const textValue=m=>m.value==null?'Unavailable':typeof m.value==='boolean'?(m.value?'Detected':'Not detected'):String(m.value)+(m.unit?' '+m.unit:'');
  function button(label,fn,primary=false,fixedId=null){
   const x=el('button',label,primary?'primary':null);x.type='button';if(fixedId)x.id=fixedId;x.disabled=working;x.addEventListener('click',fn);return x;
  }
  function titleFor(id){return ND.labScenarios.find(x=>x.id===id)?.title||'Controlled case'}
  function statsFor(report){
   const stats=el('div',null,'metrics');
   for(const m of report.measurements){const k=el('div',null,'metric');k.append(el('span',m.label),el('strong',textValue(m)),el('small',m.status||'unknown'));stats.append(k);}
   return stats;
  }
  function paint(focus=null){
   if(!active)return;
   const head=el('header',null,'judge-head'),intro=el('div'),title=el('h1','Pick a Fault');title.id='judge-title';title.tabIndex=-1;
   intro.append(el('div','JUDGE MODE / ISOLATED LAB','micro'),title,el('p','Pick any sealed card. NetDoctor measures the local test network before you reveal which condition was applied. No venue Wi-Fi needed.'));head.append(intro);board.replaceChildren(head);
   const area=el('div',null,'judge-cards');area.setAttribute('aria-label','Six sealed test cards');
   order.forEach((_,index)=>{
    const x=button('',()=>run(index),'', 'judge-card-'+(index+1));x.setAttribute('aria-label','Choose sealed card '+(index+1));x.append(el('strong','Card '+(index+1)),el('small','Sealed case'));
    x.disabled=working||hidden!==null||revealed!==null;area.append(x);
   });
   board.append(area);
   const status=el('p',message,'judge-status');status.id='judge-status';status.setAttribute('role','status');board.append(status);
   if(hidden){
    const x=el('section',null,'judge-result');
    x.append(el('div','MEASURED VERDICT / CONDITION SEALED','micro'),el('h2',verdicts[hidden.diagnosis.code]||'Measured evidence is available'),el('p','This verdict was committed from the measurements. The condition assigned to the card is still hidden.','judge-copy'));
    x.append(statsFor(hidden));
    const observations=el('div',null,'detail');observations.append(el('h3','What was observed'));
    for(const fact of hidden.evidence.slice(0,3))observations.append(el('p',fact));
    x.append(observations);
    const actions=el('div',null,'judge-actions');actions.append(button('Reveal the condition',reveal,true,'judge-reveal'),button('Discard round',reset,false,'judge-discard'));x.append(actions);board.append(x);
   }
   if(revealed){
    const x=el('section',null,'judge-result');
    x.append(el('div','CARD '+(card+1)+' / MEASURED LOOPBACK','micro'),el('h2',revealed.diagnosis.title),el('p','Selected condition: '+titleFor(revealed.scenario),'judge-copy'),el('p',revealed.diagnosis.summary,'judge-copy'));
    x.append(statsFor(revealed));
    const summary=el('div',null,'judge-details');
    for(const [heading,value] of [['Result',revealed.diagnosis.code==='inconclusive'?'Evidence is mixed. Do not attribute the fault to the ISP or local equipment.':revealed.diagnosis.title],['Evidence',revealed.evidence[0]||'Review the redacted measured observations.'],['Next safe action',revealed.diagnosis.code==='inconclusive'?'Retest with the clean control; if the issue persists on a real connection, share the redacted report with support.':revealed.actions[0]||'Compare with a clean control before escalating.']]){
     const k=el('section',null,'detail');k.append(el('h3',heading),el('p',value));summary.append(k);
    }
    x.append(summary);
    if(after){
     const comparison=el('section',null,'detail');comparison.append(el('h3','Before and after: clean control'),el('p',after.diagnosis.title));
     const lines=el('ul',null,'judge-compare');
     ND.compare(revealed,after).slice(0,8).forEach(m=>lines.append(el('li',m.label+': '+m.from+' → '+m.to+(m.unit?' '+m.unit:''))));
     for(const b of revealed.measurements){const a=after.measurements.find(m=>m.id===b.id);if(a&&a.status!==b.status)lines.append(el('li',b.label+' status: '+b.status+' → '+a.status));}
     comparison.append(lines);x.append(comparison);
    }
    const actions=el('div',null,'judge-actions');
    actions.append(button('Run clean retest',retest,true,'judge-retest'),button('Export result PDF',()=>save('pdf',revealed)),button('Export result JSON',()=>save('json',revealed)));
    if(after)actions.append(button('Export clean PDF',()=>save('pdf',after)));
    actions.append(button('New round',reset,false,'judge-reset'));x.append(actions);board.append(x);
   }
   if(focus)board.querySelector('#'+focus)?.focus({preventScroll:true});
  }
  async function measure(scenario){
   if(!app)throw Error('Desktop bridge unavailable');
   const raw=await app.diagnose('lab','unknown',scenario);
   if(raw?.mode!=='demo'||raw?.provenance?.source!=='controlled-loopback'||raw?.scenario!==scenario)throw Error('Measured case mismatch');
   return ND.normalize(raw);
  }
  async function run(index){
   if(!active||working||hidden||revealed)return;
   card=index;working=true;message='Card '+(index+1)+' is sealed. Measuring on the isolated lab…';paint();
   try{hidden=await measure(order[index]);message='Card '+(index+1)+' is measured. The condition is still sealed; history is unchanged.';}
   catch{card=null;message='Could not complete this local measurement. Make sure the Python helper is ready and try again.';}
   finally{working=false;paint(hidden?'judge-reveal':null);}
  }
  function reveal(){
   if(!active||working||!hidden||revealed)return;
   revealed=hidden;hidden=null;message='Result revealed and saved to local history.';commit(revealed);paint('judge-retest');
  }
  async function retest(){
   if(!active||working||!revealed)return;
   working=true;message='Measuring the clean control…';paint();
   try{after=await measure('control');commit(after);message='Clean retest finished. Compare the measured observations below.';}
   catch{message='Clean retest could not finish. The revealed result is still available.';}
   finally{working=false;paint('judge-retest');}
  }
  function reset(){
   if(working)return;
   order=shuffled();hidden=null;revealed=null;after=null;card=null;message='Choose one sealed case to begin.';paint('judge-title');
  }
  return {open(){active=true;reset();},close(){active=false;hidden=null;revealed=null;after=null;card=null;board.replaceChildren();},busy(){return working;}};
 }
 window.NetDoctorJudge={mount};
})();
