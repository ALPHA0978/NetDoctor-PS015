'use client';
import {useEffect,useState} from 'react';
type Theme='light'|'dark';
const key='netdoctor.web.theme';
export function ThemeSwitch(){
 const [theme,setTheme]=useState<Theme>('light');
 useEffect(()=>{
  let saved:string|null=null;
  try{saved=localStorage.getItem(key)}catch{}
  const preferred=saved==='dark'||saved==='light'?saved:window.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light';
  setTheme(preferred);document.documentElement.dataset.theme=preferred;
 },[]);
 function change(){
  const next=theme==='light'?'dark':'light';
  setTheme(next);document.documentElement.dataset.theme=next;
  try{localStorage.setItem(key,next)}catch{}
 }
 return <button type="button" className="theme-switch" aria-label={'Switch to '+(theme==='light'?'dark':'light')+' theme'} onClick={change}>{theme==='light'?'Dark theme':'Light theme'}</button>;
}
