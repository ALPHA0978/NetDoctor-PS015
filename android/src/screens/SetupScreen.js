import React from 'react';
import { TextInput } from 'react-native';
import { useTheme } from '../theme';
import { Button, Head, ListPanel, Panel, Txt } from '../components/ui';


export function SetupScreen({base,draft,setDraft,setupBusy,setupNote,checkAddress,isDisabled}) { const {S,st}=useTheme();
 return <>
        <Head eyebrow="TRUSTED LOCAL NETWORK" title="Connect your desktop probe" subtitle="Optional. The phone status check and controlled demos do not need a PC."/>
        <Panel>
          <Txt style={st.cardTitle}>PC service address</Txt>
          <Txt style={st.muted}>Enter the LAN address of a NetDoctor service you control. Local HTTP is unencrypted; only use trusted Wi-Fi. Do not expose the service to the public internet.</Txt>
          <TextInput value={draft} onChangeText={setDraft} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.10:8765" placeholderTextColor={S.muted} accessibilityLabel="PC service address" style={st.input} editable={!setupBusy}/>
          {base?<Txt style={st.hint}>Saved: {base}</Txt>:null}
          <Button label={setupBusy?'Checking…':'Check and save address'} onPress={checkAddress} disabled={isDisabled} busy={setupBusy}/>
          {setupNote?<Txt accessibilityLiveRegion="polite" style={st.notice}>{setupNote}</Txt>:null}
        </Panel>
        <ListPanel title="Set up on the same network" items={['Start the Python diagnostic service on the PC in its explicitly enabled LAN mode.','Connect your phone and PC to the same trusted Wi-Fi or private network.','Use the PC’s LAN IPv4 address, not localhost. Emulator users can normally use 10.0.2.2.']}/>
      </>;
}
