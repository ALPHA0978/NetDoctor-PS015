import React, {createContext,useContext,useEffect,useState} from 'react';
import {StyleSheet,useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const light={ink:'#102039',muted:'#4F617B',paper:'#F1F4FA',white:'#FFFFFF',line:'#D6DFEC',
  dark:'#111C35',hero:'#182B4D',accent:'#185ABC',pale:'#E9EEFF',aqua:'#A2EAD9',
  good:'#006A53',warning:'#8A4708',softwarn:'#FFF0D9',softgood:'#E7F8F3'};
const dark={...light,paper:'#111722',white:'#192435',ink:'#ecf4ff',muted:'#b4c6dc',line:'#34465f',
  dark:'#1b3150',hero:'#223f67',accent:'#9bc5ff',pale:'#253957',aqua:'#b5e0ff',
  good:'#a3e6b4',warning:'#ffd28d',softwarn:'#4a3823',softgood:'#233e37'};
const createStyles=S=>StyleSheet.create({
  shell:{flex:1,backgroundColor:S.paper},
  text:{color:S.ink,fontSize:16,lineHeight:22},
  top:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:18,paddingTop:8,paddingBottom:12,borderBottomWidth:1,borderColor:S.line},
  mark:{width:42,height:42,borderRadius:14,backgroundColor:S.accent,flexDirection:'row',alignItems:'flex-end',justifyContent:'center',paddingBottom:11,gap:3},
  markLow:{width:4,height:8,borderRadius:2,backgroundColor:'#EA4335'},markMid:{width:4,height:14,borderRadius:2,backgroundColor:'#FBBC04'},markHigh:{width:4,height:20,borderRadius:2,backgroundColor:'#34A853'},
  grow:{flex:1,minWidth:0},brand:{fontWeight:'800',fontSize:22,lineHeight:24,letterSpacing:-.5},brandSub:{color:S.muted,fontSize:12,lineHeight:18},
  scroll:{padding:17,paddingBottom:26,gap:14,width:'100%',maxWidth:660,alignSelf:'center'},
  hero:{backgroundColor:S.dark,borderRadius:22,paddingHorizontal:20,paddingVertical:22,overflow:'hidden',gap:9},
  heroStripe:{position:'absolute',right:-46,bottom:-69,width:190,height:190,borderRadius:95,borderWidth:27,borderColor:S.hero},
  heroKicker:{color:S.aqua,fontWeight:'800',fontSize:11,lineHeight:16,letterSpacing:1.7},
  heroTitle:{color:'#FFFFFF',fontSize:29,lineHeight:34,fontWeight:'800',letterSpacing:-1.1},
  heroBody:{color:'#CCD8ED',fontSize:15,lineHeight:22,maxWidth:390},
  block:{gap:5,paddingTop:3},eyebrow:{color:S.accent,fontSize:11,lineHeight:15,fontWeight:'800',letterSpacing:1.5},
  section:{fontSize:27,lineHeight:32,fontWeight:'800',letterSpacing:-.55},muted:{color:S.muted,fontSize:15,lineHeight:22},
  stack:{gap:8},innerStack:{gap:8,marginVertical:2},
  panel:{backgroundColor:S.white,borderColor:S.line,borderWidth:1,borderRadius:17,padding:15,gap:10},
  result:{backgroundColor:S.pale},
  subhead:{fontWeight:'800',fontSize:15},cardTitle:{fontWeight:'800',fontSize:18,lineHeight:24,letterSpacing:-.1},
  hint:{color:S.muted,fontSize:13,lineHeight:19},wrap:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:7},
  pick:{padding:12,borderWidth:1,borderColor:S.line,borderRadius:13,backgroundColor:S.white,flexDirection:'row',alignItems:'center',gap:10,minHeight:61},
  selected:{borderWidth:1,borderColor:S.accent,backgroundColor:S.pale},
  pickTitle:{fontWeight:'700',fontSize:16,lineHeight:21},
  glyph:{width:32,height:32,borderRadius:9,backgroundColor:S.pale,color:S.accent,fontSize:11,fontWeight:'800',textAlign:'center',textAlignVertical:'center',lineHeight:32},
  radio:{width:18,height:18,borderRadius:10,borderColor:'#8293AB',borderWidth:2,alignItems:'center',justifyContent:'center'},
  radioSelected:{borderColor:S.accent},radioDot:{width:8,height:8,borderRadius:5,backgroundColor:S.accent},
  chip:{minHeight:46,justifyContent:'center',borderWidth:1,borderColor:S.line,borderRadius:10,paddingHorizontal:10},
  chipActive:{borderColor:S.accent,backgroundColor:S.pale},
  button:{minHeight:49,backgroundColor:S.accent,borderRadius:12,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9,paddingVertical:10,paddingHorizontal:13},
  secondary:{backgroundColor:S.white,borderWidth:1,borderColor:S.accent},
  buttonText:{fontWeight:'800',color:S===dark?'#10223a':'#FFFFFF',textAlign:'center',fontSize:15},secondaryText:{color:S.accent},
  pressed:{opacity:.72},disabled:{opacity:.55},
  badge:{borderRadius:12,backgroundColor:S.pale,paddingHorizontal:8,paddingVertical:4},badgeText:{fontSize:11,lineHeight:16,fontWeight:'800',color:S.accent},
  badgeWarn:{backgroundColor:S.softwarn},badgeGood:{backgroundColor:S.softgood},textWarn:{color:S.warning},textGood:{color:S.good},
  listRow:{flexDirection:'row',alignItems:'flex-start',gap:9},index:{fontSize:11,lineHeight:22,fontWeight:'800',color:S.accent,minWidth:15},
  measure:{paddingVertical:8,borderTopWidth:1,borderColor:S.line,flexDirection:'row',gap:10,alignItems:'center'},
  measureRight:{alignItems:'flex-end',maxWidth:'44%'},measureValue:{fontWeight:'800',textAlign:'right',fontSize:15},
  history:{flexDirection:'row',alignItems:'center'}, notice:{backgroundColor:S.softwarn,color:S.warning,padding:10,borderRadius:10,fontSize:14,lineHeight:20},
  input:{backgroundColor:S.paper,color:S.ink,borderColor:'#A5B4CC',borderWidth:1,padding:11,borderRadius:10,minHeight:48,fontSize:16},
  nav:{backgroundColor:S.white,borderTopWidth:1,borderColor:S.line,flexDirection:'row',gap:4,padding:7,paddingHorizontal:11},
  navItem:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',padding:3,borderRadius:9},
  navActive:{backgroundColor:S.pale},navNo:{fontSize:10,lineHeight:13,fontWeight:'800',color:S.muted},
  navText:{fontSize:13,lineHeight:17,fontWeight:'700',color:S.muted,textAlign:'center'},navTextActive:{color:S.accent}
});

const palettes={light:{S:light,st:createStyles(light)},dark:{S:dark,st:createStyles(dark)}};
const ThemeContext=createContext({...palettes.light,theme:'light',toggle:()=>{}});
export const useTheme=()=>useContext(ThemeContext);
export function ThemeProvider({children}){
 const system=useColorScheme();
 const [override,setOverride]=useState(null);
 useEffect(()=>{let active=true;AsyncStorage.getItem('netdoctor.mobile.theme').then(v=>{if(active&&(v==='dark'||v==='light'))setOverride(v)}).catch(()=>{});return()=>{active=false}},[]);
 const theme=override??(system==='dark'?'dark':'light');
 function toggle(){
  const next=theme==='light'?'dark':'light';setOverride(next);
  void AsyncStorage.setItem('netdoctor.mobile.theme',next).catch(()=>{});
 }
 return <ThemeContext.Provider value={{...palettes[theme],theme,toggle}}>{children}</ThemeContext.Provider>;
}
