import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Button, Head, Panel, Pick, Txt } from '../components/ui';
import { modes, desc } from '../model/presentation';
import { EXAMPLES } from '../../diagnostics.cjs';

export function DiagnosticScreen({mode,scenario,setScenario,labOptions,labScenario,setLabScenario,access,setAccess,error,busy,isDisabled,base,open,choose,run}) { const {S,st}=useTheme();
 return <>
        <View style={st.hero}>
          
          <Txt style={st.heroTitle} accessibilityRole="header">Check your connection.</Txt>
          <Txt style={st.heroBody}>Check what’s working, see what isn’t, and take evidence to support.</Txt>
        </View>
        <Head title="Choose what to measure" subtitle="You decide what to measure. Nothing runs in the background."/>
        <View accessibilityRole="radiogroup" style={st.stack}>{modes.map(item=><Pick key={item.id} title={item.title} hint={item.sub} glyph={item.glyph} selected={mode===item.id} onPress={()=>choose(item.id)}/>)}</View>
        <Panel>
          <Txt style={st.muted}>{desc[mode]}</Txt>
          {mode==='demo'?<View style={st.innerStack} accessibilityRole="radiogroup">{EXAMPLES.map(item=><Pick key={item.id} title={item.title} hint={item.description} selected={scenario===item.id} onPress={()=>setScenario(item.id)}/>)}</View>:null}
          {mode==='lab'?<>
            {!base?<Button label="Set PC address" secondary onPress={()=>open('setup')}/>:null}
            <View style={st.innerStack} accessibilityRole="radiogroup">{labOptions.map(item=><Pick key={item.id} title={item.title} hint={item.description} selected={labScenario===item.id} onPress={()=>setLabScenario(item.id)}/>)}</View>
          </>:null}
          {mode==='live'?<>
            {!base?<Button label="Set PC address" secondary onPress={()=>open('setup')}/>:null}
            <Txt style={st.subhead}>How is the PC connected?</Txt>
            <View style={st.wrap} accessibilityRole="radiogroup">{['unknown','wifi','ethernet'].map(id=><Pressable key={id} accessibilityRole="radio" accessibilityState={{selected:access===id}} onPress={()=>setAccess(id)} style={[st.chip,access===id&&st.chipActive]}>
              <Txt style={st.hint}>{id==='wifi'?'Wi-Fi':id==='ethernet'?'Ethernet':'Not sure'}</Txt>
            </Pressable>)}</View>
          </>:null}
          {error?<Txt accessibilityRole="alert" style={st.notice}>{error}</Txt>:null}
          {busy?<Txt style={st.muted} accessibilityLiveRegion="polite">Collecting evidence. No new result yet.</Txt>:null}
          <Button label={busy?'Measuring…':mode==='demo'?'Run controlled example':mode==='live'?'Run live desktop check':mode==='lab'?'Run measured lab':'Check this phone'} onPress={()=>run()} disabled={isDisabled||(mode==='live'||mode==='lab')&&!base} busy={busy}/>
        </Panel>
      </>;
}
