export const modes=[
  {id:'device',title:'This phone',sub:'Android connection status',glyph:'01'},
  {id:'live',title:'Desktop probe',sub:'Live checks from your PC',glyph:'02'},
  {id:'lab',title:'Measured lab',sub:'Controlled scenarios on your PC',glyph:'03'},
  {id:'demo',title:'Offline examples',sub:'No network; synthetic fixtures',glyph:'04'}
];
export const nav=[['check','Check'],['report','Evidence'],['history','History'],['setup','Setup']];
export const scope=(r)=>r.mode==='demo'?(r.provenance?.source==='controlled-loopback'?'Measured lab':'Synthetic'):(r.mode==='live'?'Live · PC':'Live · Phone status');
export const date=(s)=>new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export const desc={device:'Read your phone’s connection type and reachability without collecting identifying network details.',live:'Use your own desktop on the same network to look closer. Results describe that PC, not this phone.',lab:'Run actual measurements against a fault injected on your PC’s loopback interface. This checks the diagnostic method, not your ISP.',demo:'Practice reading evidence and sharing a report without running any network measurements.'};

