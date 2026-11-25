import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Badge, Button, Head, Panel, Txt } from '../components/ui';
import { scope, date } from '../model/presentation';

export function HistoryScreen({history,see,open,isDisabled,removeHistory}) { const {S,st}=useTheme();
 return <>
        <Head eyebrow="ON THIS DEVICE" title="Report history" subtitle="Up to 40 reports stay on this phone. No account, cloud sync, or background uploads."/>
        {history.length?history.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>see(item)} style={({pressed})=>[st.panel,st.history,pressed&&st.pressed]}>
          <View style={st.grow}><Txt style={st.pickTitle}>{item.diagnosis.title}</Txt><Txt style={st.hint}>{date(item.created_at)}</Txt></View>
          <Badge tone={item.mode==='demo'?'warn':'good'}>{scope(item)}</Badge>
        </Pressable>):<Panel><Txt style={st.muted}>Your reports will appear here after the first check.</Txt><Button label="Start a check" onPress={()=>open('check')}/></Panel>}
        {history.length?<Button label="Clear local history" secondary disabled={isDisabled} onPress={removeHistory}/>:null}
      </>;
}
