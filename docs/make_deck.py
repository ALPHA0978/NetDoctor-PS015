"""Generate the Windows PS-015 jury deck. Requires python-pptx."""
from pathlib import Path
import argparse
import json
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR

BASE=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__)
p.add_argument("--team", default="Official team name pending")
p.add_argument("--output", type=Path, default=BASE/"NetDoctor-PS015-Jury-Deck.pptx")
p.add_argument("--blind-evidence", type=Path, help="Verified Windows loopback evaluation JSON")
a=p.parse_args()
from jury_evidence import load_summary
fresh=load_summary(a.blind_evidence) if a.blind_evidence else None
data=json.loads((BASE/"control-evaluation.json").read_text(encoding="utf-8-sig"))
r=Presentation()
r.slide_width=Inches(13.333); r.slide_height=Inches(7.5)
NAVY="102532"; PANEL="193845"; WHITE="F4F8F7"; TEAL="69E3CB"; GRAY="B6CED2"; LINE="41606B"
def rgb(x):return RGBColor.from_string(x)
def rect(s,x,y,w,h,c):
 sh=s.shapes.add_shape(MSO_SHAPE.RECTANGLE,Inches(x),Inches(y),Inches(w),Inches(h))
 sh.fill.solid();sh.fill.fore_color.rgb=rgb(c);sh.line.fill.background()
def txt(s,x,y,w,h,value,size,c=WHITE,bold=False):
 sh=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h))
 tf=sh.text_frame;tf.clear();tf.word_wrap=True;tf.vertical_anchor=MSO_ANCHOR.MIDDLE
 tf.margin_left=tf.margin_right=tf.margin_top=tf.margin_bottom=0
 for i,line in enumerate(value.split("\n")):
  par=tf.paragraphs[0] if not i else tf.add_paragraph()
  run=par.add_run();run.text=line;f=run.font
  f.name="Aptos";f.size=Pt(size);f.bold=bold;f.color.rgb=rgb(c)
def slide(k,title):
 s=r.slides.add_slide(r.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=rgb(NAVY)
 txt(s,.72,.42,11,.29,k,12,TEAL,True)
 txt(s,.72,.83,11.88,1.05,title,35,WHITE,True)
 rect(s,.72,1.94,11.9,.021,LINE)
 txt(s,.72,7.08,10,.22,"NETDOCTOR   /   AIORI-3  NORTH REGIONAL   /   PS-015",9,GRAY,True)
 txt(s,12.15,7.08,.44,.22,f"{len(r.slides):02}",9,TEAL,True)
 return s
def cards(s,entries,top=2.38,h=2.64):
 w=(11.88-(len(entries)-1)*.24)/len(entries)
 for i,(label,body) in enumerate(entries):
  x=.72+i*(w+.24);rect(s,x,top,w,h,PANEL)
  txt(s,x+.21,top+.16,w-.42,.36,label,12,TEAL,True)
  txt(s,x+.21,top+.62,w-.42,h-.83,body,20)
def footer(s,t):
 txt(s,.74,6.14,11.82,.54,t,16,TEAL,True)
s=slide("AIORI-3  /  SMART CITIES","")
txt(s,.72,2.17,11.88,1.10,"NetDoctor",78,WHITE,True)
txt(s,.75,3.44,11.6,.65,"Explainable home and last-mile connectivity diagnosis",25)
txt(s,.75,4.55,10.8,.8,"Pick a fault. Read the evidence. Reveal the condition.",23,TEAL,True)
txt(s,.75,6.0,10.8,.43,a.team,15,GRAY)
s=slide("01 / THE PROBLEM","The same symptom can have different causes.")
cards(s,[("A HOUSEHOLD HEARS","“The connection is slow.” Peak download speed cannot isolate the cause."),("SUPPORT NEEDS","A likely explanation, the measurements behind it and the safest next check.")])
footer(s,"No confident verdict without sufficient evidence.")
s=slide("02 / WINDOWS DESKTOP","Let the judge choose the test.")
cards(s,[("01  PICK","Choose a sealed card. The window does not name its condition."),("02  MEASURE","Read the independent verdict and measured evidence while the condition stays sealed."),("03  REVEAL","Reveal only the condition. Compare with the verdict, retest clean and export.")],h=2.89)
footer(s,"Reference demonstration: Windows desktop and isolated loopback only.")
s=slide("03 / SIX CONTROLLED CONDITIONS","Four faults, a clean control and one ambiguity.")
cases=[("CLEAN","All required observations agree."),("GATEWAY","Gateway surrogate does not respond."),("DNS","Gateway answers; resolver fails."),("PACKET LOSS","Compare sent and returned datagrams."),("CONGESTION","Compare idle and loaded RTT."),("COMPOUND","Competing evidence: Inconclusive.")]
for i,(label,body) in enumerate(cases):
 x=.72+(i%3)*4.04;y=2.24+(i//3)*1.65;rect(s,x,y,3.78,1.43,PANEL)
 txt(s,x+.2,y+.14,3.38,.28,label,11,TEAL,True)
 txt(s,x+.2,y+.48,3.38,.77,body,17)
footer(s,"The fault is locally injected; the probe observations are measured.")
s=slide("04 / SUPPORT HANDOFF","Give support a report they can act on.")
cards(s,[("CONTEXT","Run ID, timestamp, source, units and sample counts."),("JUDGMENT","Likely cause or Inconclusive, with the signals and any conflicting evidence."),("NEXT STEP","An appropriate next check, a comparable clean retest and a redacted export.")],h=2.94)
footer(s,"Review the exported report before sharing it.")
s=slide("05 / EVIDENCE BOUNDARY","Match the claim to the conditions tested.")
if fresh:
 cards(s,[("WINDOWS LAB",f"{fresh['passed']}/{fresh['total']} outcomes matched across {fresh['rounds']} randomized rounds. Compound: {fresh['ambiguous_passed']}/{fresh['ambiguous_total']} Inconclusive."),("MEASUREMENT-ONLY REPLAY",f"{fresh['replay']}/{fresh['total']} matched without the injected case label. Review the separate test report for UI, retest and export results.")],h=2.96)
else:
 cards(s,[("PRIOR BASELINE",f"{data['passed']}/{data['total']} matched across three Windows loopback rounds. The prior set omitted compound ambiguity."),("SEPARATE TEST REPORT","Use retained results for new measurements, UI checks, retest and export. Do not reuse the prior count.")],h=2.96)
footer(s,"Controlled evidence is not field accuracy.")
s=slide("06 / LIMITS & NEXT WORK","Do not overstate what the demo can see.")
cards(s,[("CONTROLLED LAB","Loopback service surrogates. No external fault injection or broadband performance claim."),("LIVE MODE","Separate read-only probes. No definitive cable, radio or ISP-internal claims."),("PILOT DESIGN","No volunteer endpoints yet. Gemini is optional; no live Gemini key needed.")],h=2.94)
footer(s,"A field pilot needs consent, verified access media and repeated measurements.")
a.output.parent.mkdir(parents=True,exist_ok=True)
r.save(a.output)

