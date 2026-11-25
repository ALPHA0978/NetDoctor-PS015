import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

export function Txt({style,children,...props}) { const {S,st}=useTheme();return <Text style={[st.text,style]} {...props}>{children}</Text>;}
export function Panel({children,style}){ const {S,st}=useTheme();return <View style={[st.panel,style]}>{children}</View>;}
export function Head({eyebrow,title,subtitle}){ const {S,st}=useTheme();return <View style={st.block}>
  {eyebrow?<Txt style={st.eyebrow}>{eyebrow}</Txt>:null}<Txt accessibilityRole="header" style={st.section}>{title}</Txt>
  {subtitle?<Txt style={st.muted}>{subtitle}</Txt>:null}
</View>;}
export function Button({label,onPress,secondary=false,disabled=false,busy=false}){ const {S,st}=useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{disabled,busy}} onPress={onPress} disabled={disabled} android_ripple={{color:"#1764CC33",borderless:false}}
    style={({pressed})=>[st.button,secondary&&st.secondary,pressed&&st.pressed,disabled&&st.disabled]}>
      {busy?<ActivityIndicator color={secondary?S.accent:S.white}/>:null}<Txt style={[st.buttonText,secondary&&st.secondaryText]}>{label}</Txt>
  </Pressable>;
}
export function Badge({children,tone}){ const {S,st}=useTheme();return <View style={[st.badge,tone==='warn'?st.badgeWarn:tone==='good'?st.badgeGood:null]}>
  <Txt style={[st.badgeText,tone==='warn'?st.textWarn:tone==='good'?st.textGood:null]}>{children}</Txt>
</View>;}
export function Pick({title,hint,selected,onPress,glyph}){ const {S,st}=useTheme();
  return <Pressable accessibilityRole="radio" accessibilityState={{selected}} onPress={onPress} android_ripple={{color:"#1764CC22",borderless:false}}
    style={({pressed})=>[st.pick,selected&&st.selected,pressed&&st.pressed]}>
    {glyph?<Txt style={st.glyph}>{glyph}</Txt>:null}
    <View style={st.grow}><Txt style={st.pickTitle}>{title}</Txt>{hint?<Txt style={st.hint}>{hint}</Txt>:null}</View>
    <View style={[st.radio,selected&&st.radioSelected]}>{selected?<View style={st.radioDot}/>:null}</View>
  </Pressable>;
}
export function ListPanel({title,items}){ const {S,st}=useTheme();
  if(!items?.length)return null;
  return <Panel><Txt accessibilityRole="header" style={st.cardTitle}>{title}</Txt>
    {items.map((item,i)=><View key={i} style={st.listRow}><Txt style={st.index}>{String(i+1).padStart(2,'0')}</Txt><Txt style={[st.muted,st.grow]}>{item}</Txt></View>)}
  </Panel>;
}
