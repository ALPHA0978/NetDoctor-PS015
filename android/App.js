import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Pressable, ScrollView, Share, StatusBar, View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import {
  HISTORY_LIMIT, simulate, hostUrl, sanitize, fromDevice,
  api, diagnoseDesktop, difference, exportReport
} from './diagnostics.cjs';
import { ThemeProvider, useTheme } from './src/theme';
import { Txt } from './src/components/ui';
import { nav } from './src/model/presentation';
import { DiagnosticScreen } from './src/screens/DiagnosticScreen';
import { EvidenceScreen } from './src/screens/EvidenceScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SetupScreen } from './src/screens/SetupScreen';

const KEY='netdoctor.mobile.v1';
const LAB_IDS=['gateway','dns','packet_loss','congestion','ambiguous','control'];
const API_DEFAULT=process.env.EXPO_PUBLIC_NETDOCTOR_API ?? '';
function AppContent(){
  const {S,st,theme,toggle}=useTheme();
  const [tab,setTab]=useState('check');
  const [mode,setMode]=useState('device');
  const [scenario,setScenario]=useState('wifi');
  const [access,setAccess]=useState('unknown');
  const [labScenario,setLabScenario]=useState('gateway');
  const [labOptions,setLabOptions]=useState([
    {id:'gateway',title:'Gateway unreachable',description:'No response from the lab gateway.'},
    {id:'dns',title:'DNS failure',description:'The controlled resolver returns a failure.'},
    {id:'packet_loss',title:'Induced packet loss',description:'Controlled packet drops reduce reachability.'},
    {id:'congestion',title:'Congestion',description:'Delay increases while the lab link is loaded.'},
    {id:'ambiguous',title:'Conflicting signals',description:'The PC lab gateway does not reply, DNS returns SERVFAIL, and the packet check still passes.'},
    {id:'control',title:'Healthy control',description:'Reference measurements without an injected fault.'}
  ]);
  const [base,setBase]=useState(API_DEFAULT);
  const [draft,setDraft]=useState(API_DEFAULT);
  const [busy,setBusy]=useState(false);
  const [setupBusy,setSetupBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [history,setHistory]=useState([]);
  const [report,setReport]=useState(null);
  const [baseline,setBaseline]=useState(null);
  const [error,setError]=useState('');
  const [setupNote,setSetupNote]=useState('');
  const [storageNote,setStorageNote]=useState('');
  const reports=useRef([]);
  const probeSerial=useRef('probe-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const busyRef=useRef(false);
  const setupRef=useRef(false);
  const scroll=useRef(null);

  useEffect(()=>{
    let live=true;
    AsyncStorage.getItem(KEY).then(value=>{
      if(!live||!value)return;
      let saved;
      try {saved=JSON.parse(value);} catch {return;}
      if(typeof saved.base==='string') {try {const addr=hostUrl(saved.base);setBase(addr);setDraft(addr);} catch {}}
      if(typeof saved.probeSerial==='string'&&/^probe-[0-9]+-[a-z0-9]+$/.test(saved.probeSerial))probeSerial.current=saved.probeSerial;
      if(!Array.isArray(saved.history))return;
      const loaded=saved.history.slice(0,HISTORY_LIMIT).flatMap(x=>{try{return [{...sanitize(x),...(typeof x.probeSerial==='string'&&x.probeSerial.startsWith('probe-')?{probeSerial:x.probeSerial}:{})}];}catch{return [];}});
      reports.current=loaded;setHistory(loaded);
    }).catch(()=>{if(live)setStorageNote('Local storage unavailable. New reports can still be shared.');})
      .finally(()=>{if(live)setReady(true);});
    return ()=>{live=false;};
  },[]);

  function open(next) {setTab(next);requestAnimationFrame(()=>scroll.current?.scrollTo({y:0,animated:false}));}
  async function save(items,address) {
    try {await AsyncStorage.setItem(KEY,JSON.stringify({history:items,base:address,probeSerial:probeSerial.current}));}
    catch {setStorageNote('Couldn’t save locally. Share important reports before closing the app.');}
  }
  function choose(next){setMode(next);setError('');}
  async function run(previous=null,revisedScenario=null){
    if(busyRef.current||setupRef.current||!ready)return;
    busyRef.current=true;setBusy(true);setError('');
    const nextMode=previous?(previous.provenance?.source==='controlled-loopback'?'lab':previous.mode):mode;
    const nextScenario=revisedScenario??previous?.scenario??(nextMode==='lab'?labScenario:scenario);
    const nextAccess=previous?.access??access;
    try {
      let result;
      if(nextMode==='demo')result=simulate(nextScenario,nextAccess);
      else if(nextMode==='device')result=fromDevice(await Network.getNetworkStateAsync());
      else {
        if(!base)throw new Error('Set up your NetDoctor PC address first. The app will never switch to an example by itself.');
        result=await diagnoseDesktop(base,{kind:nextMode,scenario:nextScenario,access:nextAccess});
      }
      const safe={...sanitize(result),...(['live','lab'].includes(nextMode)?{probeSerial:probeSerial.current}:{})};
      const ordered=[safe,...reports.current.filter(r=>r.id!==safe.id)].slice(0,HISTORY_LIMIT);
      reports.current=ordered;setHistory(ordered);setBaseline(previous);setReport(safe);
      open('report');await save(ordered,base);
    } catch(e) {
      let label=e?.message||'Could not complete the check.';
      if((nextMode==='live'||nextMode==='lab')&&/network request failed|failed to fetch|load failed/i.test(label))label='Cannot reach the PC. Check its address, trusted Wi‑Fi, and the locally running Python service.';
      setError(label);open(previous?'report':'check');
    } finally {busyRef.current=false;setBusy(false);}
  }
  async function checkAddress(){
    if(setupRef.current||busyRef.current||!ready)return;
    setupRef.current=true;setSetupBusy(true);setSetupNote('Checking your PC…');setError('');
    try {
      const addr=hostUrl(draft);
      const health=await api(addr,'/health');
      const items=await api(addr,'/scenarios');
      if(!health||typeof health!=='object'||!Array.isArray(items))throw new Error('That address did not return a NetDoctor response.');
      const available=items.filter(i=>LAB_IDS.includes(i?.id)&&typeof i?.title==='string').map(i=>({id:i.id,title:i.title,description:typeof i.description==='string'?i.description:''}));
      if(available.length){setLabOptions(available);setLabScenario((id)=>available.some(i=>i.id===id)?id:available[0].id);}
      if(addr!==base)probeSerial.current='probe-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      setBase(addr);setDraft(addr);await save(reports.current,addr);
      setSetupNote('Connected and saved. Live results will describe that PC.');
    } catch(e){setSetupNote((e?.message??'Connection failed')+' Your saved address has not changed.');}
    finally{setupRef.current=false;setSetupBusy(false);}
  }
  function see(item){setReport(item);setBaseline(null);setError('');open('report');}
  async function share(){
    if(!report)return;
    try {await Share.share({message:exportReport(report,baseline),title:'NetDoctor privacy-filtered evidence'});}
    catch {Alert.alert('Couldn’t share','Please try the Android share sheet again.');}
  }
  function removeHistory(){
    Alert.alert('Clear local reports?', 'This removes the report history on this device. Copies already shared are not affected.',[
      {text:'Cancel',style:'cancel'},
      {text:'Clear history',style:'destructive',onPress:()=>{
        if(busyRef.current||setupRef.current)return;
        reports.current=[];setHistory([]);setReport(null);setBaseline(null);void save([],base);open('history');
      }}
    ]);
  }
  const deltas=report&&baseline?difference(baseline,report):[];
  const isDisabled=!ready||busy||setupBusy;

  return <SafeAreaView style={st.shell} edges={['top','bottom','left','right']}>
    <StatusBar barStyle={theme==='dark'?'light-content':'dark-content'} backgroundColor={S.paper}/>
    <View style={st.top}>
      <View style={st.mark} accessible={false}><View style={st.markLow}/><View style={st.markMid}/><View style={st.markHigh}/></View>
      <View style={st.grow}><Txt style={st.brand}>NetDoctor</Txt><Txt style={st.brandSub}>Connectivity diagnostics</Txt></View>
      <Pressable accessibilityRole="button" accessibilityLabel={theme==='dark'?'Switch to light theme':'Switch to dark theme'} onPress={toggle} style={st.chip}>
        <Txt style={st.hint}>{theme==='dark'?'Light':'Dark'}</Txt>
      </Pressable>
    </View>
    <ScrollView
      ref={scroll}
      contentContainerStyle={st.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      {storageNote?<Txt style={st.notice}>{storageNote}</Txt>:null}
      {tab==='check'?<DiagnosticScreen mode={mode} scenario={scenario} setScenario={setScenario} labOptions={labOptions} labScenario={labScenario} setLabScenario={setLabScenario} access={access} setAccess={setAccess} error={error} busy={busy} isDisabled={isDisabled} base={base} open={open} choose={choose} run={run}/>:null}

      {tab==='report'?<EvidenceScreen report={report} baseline={baseline} deltas={deltas} error={error} busy={busy} isDisabled={isDisabled} run={run} share={share} open={open}/>:null}

      {tab==='history'?<HistoryScreen history={history} see={see} open={open} isDisabled={isDisabled} removeHistory={removeHistory}/>:null}

      {tab==='setup'?<SetupScreen base={base} draft={draft} setDraft={setDraft} setupBusy={setupBusy} setupNote={setupNote} checkAddress={checkAddress} isDisabled={isDisabled}/>:null}
    </ScrollView>
    <View style={st.nav} accessibilityRole="tablist">{nav.map(([id,label],i)=><Pressable key={id}
      accessibilityRole="tab" accessibilityState={{selected:tab===id}} onPress={()=>open(id)}
      style={({pressed})=>[st.navItem,tab===id&&st.navActive,pressed&&st.pressed]}>
      <Txt style={[st.navNo,tab===id&&st.navTextActive]}>{String(i+1).padStart(2,'0')}</Txt>
      <Txt style={[st.navText,tab===id&&st.navTextActive]}>{label}</Txt>
    </Pressable>)}</View>
  </SafeAreaView>;
}
export default function App(){return <SafeAreaProvider><ThemeProvider><AppContent/></ThemeProvider></SafeAreaProvider>;}

