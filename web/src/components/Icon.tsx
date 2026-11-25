import type { ReactNode } from 'react';

const paths:Record<string,ReactNode>={
 pulse:<path d="M2 12h4l3-7 4 14 3-7h6"/>,
 grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 wifi:<><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r=".75" fill="currentColor"/></>,
 router:<><rect x="3" y="12" width="18" height="7" rx="2"/><path d="M7 12V7m10 5V7M7 15.5h1m3 0h1"/></>,
 globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18m0-18c-5 5-5 13 0 18"/></>,
 arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,
 chevron:<path d="m9 18 6-6-6-6"/>,
 shield:<><path d="m12 3 8 3v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
 lab:<><path d="M9 3h6m-5 1v6l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V4M8 15h8"/><path d="M10 18h.01"/></>,
 info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
 refresh:<><path d="M20 8a8 8 0 0 0-14-2L3 9m0-5v5h5m-4 7a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/></>,
 download:<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>,
 printer:<><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M6 8V3h12v5M6 17H3V9h18v8h-3M7 11h1"/></>,
 check:<path d="m5 12 4 4L19 6"/>,
 remove:<><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></>,
 link:<><path d="M10 14a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2m2 4a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2"/></>,
};
export function Icon({name,size=20}:{name:string;size?:number}) {return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]??paths.info}</svg>}
