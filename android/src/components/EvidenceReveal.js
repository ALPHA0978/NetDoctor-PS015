import React,{useEffect,useRef} from 'react';
import {AccessibilityInfo,Animated,Easing} from 'react-native';

// Evidence is visible even if native motion is disabled or unavailable.
export function EvidenceReveal({children}){
 const phase=useRef(new Animated.Value(1)).current;
 useEffect(()=>{
  let active=true;
  const disable=enabled=>{if(enabled){phase.stopAnimation();phase.setValue(1);}};
  const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',disable);
  AccessibilityInfo.isReduceMotionEnabled().then(enabled=>{
   if(!active||enabled)return;
   phase.setValue(.72);
   Animated.timing(phase,{toValue:1,duration:180,easing:Easing.bezier(.23,1,.32,1),useNativeDriver:true}).start();
  }).catch(()=>{});
  return ()=>{active=false;sub.remove();phase.stopAnimation();};
 },[phase]);
 return <Animated.View style={{opacity:phase}}>{children}</Animated.View>;
}
