'use strict';
(function attachResultView(root){
const ND=root.ND;
function el(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node}
function panel(title,values,ordered=false){
 const node=el('section',null,'detail');node.append(el('h3',title));const list=el(ordered?'ol':'ul');values.forEach(x=>list.append(el('li',x)));node.append(list);return node;
}
function renderReport(target,r,prior,running,{retest,save,explain}){
 const head=el('div',null,'result-head'),label=el('div');
 label.append(el('div',ND.typeLabel(r),'micro'));const h=el('h2',r.diagnosis.title);h.id='result-title';h.tabIndex=-1;label.append(h);head.append(label,el('span',(r.diagnosis.confidence||'Unknown')+' confidence',r.diagnosis.code==='healthy'?'badge':'badge warn'));
 target.replaceChildren(head,el('p',r.diagnosis.summary,'summary'));
 const metrics=el('div',null,'metrics');
 for(const x of r.measurements){const m=el('div',null,'metric signal-'+(['pass','warn','fail'].includes(x.status)?x.status:'unknown'));if(x.detail)m.title=x.detail;const value=x.value==null?'Not available':String(x.value)+(x.unit?' '+x.unit:'');m.append(el('span',x.label),el('strong',value),el('small',(x.status||'').replaceAll('_',' '),'signal'));metrics.append(m)}
 target.append(metrics);
 if(explain && ND.source(r)!=='fixture'){
  const section=el('section',null,'ai-evidence');
  section.append(el('h3','Gemini evidence assist'),el('p','Optional. Sends this run’s selected metric readings, verdict, and approved next steps to Google. No network addresses are included.'));
  const go=el('button','Share readings and explain');go.type='button';go.disabled=running;
  const message=el('div');message.setAttribute('role','status');
  go.addEventListener('click',async()=>{
   go.disabled=true;
   message.replaceChildren(el('p','Reviewing evidence…'));
   try{
    const answer=await explain(r.id);
    const labels=answer.evidence_ids.map(id=>r.measurements.find(m=>m.id===id)?.label).filter(Boolean);
    const next=r.actions[answer.next_action];
    if(!labels.length||!next)throw Error('Invalid evidence selection');
    message.replaceChildren(el('p','Evidence to focus on: '+labels.join(', ')+'.'),el('p','Suggested next step: '+next),el('p','This does not change the measured diagnosis.'));
   }catch(e){message.replaceChildren(el('p',e?.message?.replace(/^Error invoking remote method '[^']+': (Error: )?/,'')||'Gemini is unavailable. The measured result is unchanged.'))}
   finally{go.disabled=false}
  });
  section.append(go,message); section.dataset.optional='true';target.append(section);
 }
 const details=el('div',null,'details');details.append(panel('Why this result',r.evidence),panel('What to try next',r.actions,true));target.insertBefore(details,target.querySelector('[data-optional]'));
 if(r.diagnosis.code==='inconclusive'||r.diagnosis.code==='upstream'){
  target.append(panel('Escalation evidence',['Keep the test timestamp and export observations, not a claim of an outage.','For support: describe when it happens and which devices are affected. Run a matched retest if possible.']));
 }
 const limitation=el('details');limitation.append(el('summary','Measurement limits & privacy'));const li=el('ul');r.limitations.forEach(x=>li.append(el('li',x)));li.append(el('li','Only these redacted results are saved locally. No names, router IDs, or addresses are requested.'));limitation.append(li);target.append(limitation);
 const comparison=ND.compare(prior,r);if(comparison.length){
   const changes=comparison.map(x=>x.label+': '+x.from+' → '+x.to+' '+x.unit+(x.delta===0?' (unchanged)':' ('+(x.delta>0?'+':'')+x.delta+' '+x.unit+')'));
   const box=el('details');box.open=true;box.append(el('summary',ND.source(r)==='controlled-loopback'&&r.scenario==='control'&&prior.scenario!=='control'?'Before and after removing the lab fault':'Matched retest comparison'));const list=el('ul');changes.forEach(x=>list.append(el('li',x)));box.append(list);target.append(box);
 }
 const actions=el('div',null,'actions');
 for(const [title,fn] of [['Retest',()=>retest(r)],...(ND.source(r)==='controlled-loopback'&&r.scenario!=='control'?[['Retest without fault',()=>retest(r,'control')]]:[]),['Export PDF',()=>save('pdf',r)],['Export HTML',()=>save('html',r)],['Export JSON',()=>save('json',r)]]){const button=el('button',title);button.type='button';button.disabled=running;button.addEventListener('click',fn);actions.append(button)}target.insertBefore(actions,metrics);
}
root.NetDoctorResultView=Object.freeze({renderReport});
})(window);
