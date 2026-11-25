import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { EvidenceReveal } from '../components/EvidenceReveal';
import { Badge, Button, Head, ListPanel, Panel, Txt } from '../components/ui';
import { scope, date } from '../model/presentation';
import { comparable } from '../../diagnostics.cjs';

export function EvidenceScreen({report,baseline,deltas,error,busy,isDisabled,run,share,open}) { const {S,st}=useTheme();
 return report?<><EvidenceReveal key={report.id}><Head title={report.diagnosis.title} subtitle={report.diagnosis.summary}/></EvidenceReveal>
        <Panel style={st.result}>
          <View style={st.wrap}><Badge tone={report.mode==='demo'?'warn':'good'}>{scope(report)}</Badge><Badge>{report.diagnosis.confidence||'Not rated'}</Badge></View>
          <Txt style={st.muted}>{date(report.created_at)} · {report.access==='wifi'?'Wi-Fi':report.access}</Txt>
          {report.mode==='live'?<Txt style={st.hint}>Measured on the PC. Not a phone network test.</Txt>:null}
          {report.mode==='demo'?<Txt style={st.hint}>{report.provenance?.source==='controlled-loopback'?'Measured on the PC’s controlled loopback lab. Not traffic on your home network.':'Controlled example. Not measured on this network.'}</Txt>:null}
        </Panel>
        <Panel><Txt accessibilityRole="header" style={st.cardTitle}>Measurements</Txt>
          {report.measurements.length?report.measurements.map((m,i)=><View key={m.id+'-'+i} style={st.measure}>
            <View style={st.grow}><Txt style={st.pickTitle}>{m.label}</Txt>{m.detail?<Txt style={st.hint}>{m.detail}</Txt>:null}</View>
            <View style={st.measureRight}><Txt style={st.measureValue}>{m.value===null?'—':String(m.value)+(m.unit?' '+m.unit:'')}</Txt>{m.status?<Txt style={['warning','warn','fail'].includes(m.status)?st.textWarn:st.hint}>{m.status}</Txt>:null}</View>
          </View>):<Txt style={st.muted}>No measurements were available.</Txt>}
        </Panel>
        <ListPanel title="Why this result" items={report.evidence}/>
        <ListPanel title="What to try next" items={report.actions}/>
        <ListPanel title="What this cannot prove" items={report.limitations}/>
        {baseline?<Panel>
          <Txt accessibilityRole="header" style={st.cardTitle}>Before and after</Txt>
          <Txt style={st.muted}>{date(baseline.created_at)} → {date(report.created_at)}</Txt>
          {baseline.scenario!==report.scenario&&report.provenance?.source==='controlled-loopback'?<Txt style={st.hint}>Lab comparison: injected fault → clean control. This is not a real network recovery.</Txt>:null}
          {!comparable(baseline,report)?<Txt style={st.hint}>Conditions differ. No comparison was calculated.</Txt>:deltas.length?deltas.map(m=><View style={st.measure} key={m.id}><Txt style={[st.pickTitle,st.grow]}>{m.label}</Txt><Txt style={st.hint}>{m.before} → {m.after} {m.unit}{m.delta===0?' · no change':''}</Txt></View>):<Txt style={st.hint}>No matching numeric measurements to compare.</Txt>}
          {report.provenance?.source==='bundled-fixture'?<Txt style={st.hint}>Replays use the same fixture and do not simulate an improvement.</Txt>:null}
        </Panel>:null}
        {error?<Txt accessibilityRole="alert" style={st.notice}>{error}</Txt>:null}
        <Button label={busy?'Retesting…':'Retest this setup'} disabled={isDisabled} busy={busy} onPress={()=>run(report)}/>
        {report.provenance?.source==='controlled-loopback'&&report.scenario!=='control'?<Button label="Compare with clean lab control" secondary disabled={isDisabled} onPress={()=>run(report,'control')}/>:null}
        <Button label="Share privacy-filtered JSON" secondary onPress={share}/>
        <Txt style={st.hint}>Review the evidence before sending it. The report excludes the saved PC address.</Txt>
      </>:<><Head eyebrow="EVIDENCE REPORT" title="No report open" subtitle="Run a check or open a saved report to see its evidence here."/><Button label="Start a check" onPress={()=>open('check')}/></>;
}
