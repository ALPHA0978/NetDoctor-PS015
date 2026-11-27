'use strict';
(function attachResultView(root){
const ND=root.ND;
function el(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node}
function panel(title,values,ordered=false){
 const node=el('section',null,'detail');node.append(el('h3',title));const list=el(ordered?'ol':'ul');values.forEach(x=>list.append(el('li',x)));node.append(list);return node;
}
function buildEvidenceAssist(r,explain,running=false,compact=false){
 if(!r || !explain || ND.source(r)==='fixture')return null;
 const section=el('section',null,'ai-evidence');
 section.append(el('h3',compact?'AI next step':'Gemini evidence assist'),
  el('p','Share this run’s redacted readings, verdict, and suggested actions with Google Gemini.'));
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
   const action=el('p');
   action.append(el('strong','Suggested next step'),document.createTextNode(' '+next));
   message.replaceChildren(action,el('p','Evidence: '+labels.join(', ')+'.'));
  }catch(error){
   const reason=error?.message?.replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
   message.replaceChildren(el('p',reason||'Gemini is unavailable.'));
  }finally{go.disabled=false}
 });
 section.append(go,message);
 return section;
}
function measurementTable(measurements){
 const wrap=el('div',null,'diagnostic-table-wrap');
 wrap.tabIndex=0;
 wrap.setAttribute('role','region');
 wrap.setAttribute('aria-label','Measurement details');
 const table=el('table',null,'diagnostic-table');
 const caption=el('caption','Measurement details');
 const head=table.createTHead().insertRow();
 for(const label of ['Check','Result','Status']){
  const cell=el('th',label);cell.scope='col';head.append(cell);
 }
 const body=table.createTBody();
 for(const measurement of measurements){
  const row=body.insertRow();
  const label=el('th',measurement.label);label.scope='row';
  if(measurement.detail)label.title=measurement.detail;
  const value=measurement.value==null?'Not available':String(measurement.value)+(measurement.unit?' '+measurement.unit:'');
  const state=({pass:'Pass',warn:'Review',warning:'Review',fail:'Fail'})[measurement.status]||'Unknown';
  const status=row.insertCell();
  status.append(el('span',state,'diagnostic-status diagnostic-status-'+state.toLowerCase()));
  row.prepend(label,el('td',value));
 }
 table.prepend(caption);
 wrap.append(table);
 return wrap;
}
function renderReport(target,r,prior,running,{retest,save,explain}){
 const head=el('div',null,'result-head'),label=el('div');
 label.append(el('div',ND.typeLabel(r),'micro'));const h=el('h2',r.diagnosis.title);h.id='result-title';h.tabIndex=-1;label.append(h);head.append(label,el('span',(r.diagnosis.confidence||'Unknown')+' confidence',r.diagnosis.code==='healthy'?'badge':'badge warn'));
 target.replaceChildren(head,el('p',r.diagnosis.summary,'summary'));
 const metrics=measurementTable(r.measurements);
 target.append(metrics);
 const assist=buildEvidenceAssist(r,explain,running);
 if(assist){assist.dataset.optional='true';target.append(assist);}
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
root.NetDoctorResultView=Object.freeze({renderReport,buildEvidenceAssist});
})(window);
