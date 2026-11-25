export const displayTime=(x:string)=>new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(x));
export const displayDate=(x:string)=>new Date(x).toLocaleString();
