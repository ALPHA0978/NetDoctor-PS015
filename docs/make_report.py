"""Build the event report as an A4 PDF using only Python standard library."""
from pathlib import Path
import json, statistics, textwrap, argparse

W,H=595,842
INK=(.065,.15,.21); MUTED=(.31,.37,.43); ACC=(.02,.42,.39); TINT=(.91,.965,.952)
WHITE=(1,1,1); LINE=(.84,.88,.89)
def fmt(c): return " ".join(f"{x:.3f}" for x in c)
def esc(s):
 s=str(s).encode("cp1252","replace").decode("cp1252")
 return s.replace("\\","\\\\").replace("(","\\(").replace(")","\\)")
class Page:
 def __init__(self): self.ops=[]
 def box(self,x,y,w,h,c):
  self.ops.append(f"{fmt(c)} rg {x} {y} {w} {h} re f")
 def txt(self,x,y,s,size=11,weight=False,color=INK):
  assert 36<=x<=W-36 and 35<=y<=H-30,(x,y,s)
  self.ops.append(f"{fmt(color)} rg BT /{'F2' if weight else 'F1'} {size} Tf 1 0 0 1 {x} {y} Tm ({esc(s)}) Tj ET")
 def para(self,y,s,x=48,width=82,size=11,color=MUTED):
  for line in textwrap.wrap(s,width=width,break_long_words=False):
   self.txt(x,y,line,size,color=color);y-=17
  return y-7
 def head(self,k,title):
  self.txt(48,782,k.upper(),10,True,ACC);self.txt(48,741,title,29,True)
  self.box(48,720,499,1,LINE)
 def label(self,y,s):
  self.txt(48,y,s,14,True);return y-24
 def foot(self,n):
  self.box(48,60,499,1,LINE);self.txt(48,43,"NETDOCTOR   /   AIORI-3 PS-015",8,True,MUTED);self.txt(527,43,f"{n:02}",9,True,ACC)
 def flow(self,y,labels):
  width=114
  for i,s in enumerate(labels):
   x=48+i*129;self.box(x,y,width,37,TINT);self.txt(x+8,y+14,s,10,True,ACC)
   if i!=len(labels)-1:self.txt(x+116,y+14,">",9,True,MUTED)

def pages(team,data,fresh=None):
 y0=685; out=[]
 p=Page();p.box(0,0,W,H,INK);p.box(48,735,82,4,(.23,.82,.67))
 p.txt(48,692,"AIORI-3  /  NORTH REGIONAL  /  PS-015",12,True,(.49,.88,.78))
 p.txt(48,592,"NetDoctor",56,True,WHITE)
 p.txt(48,550,"Explainable home and",24,True,WHITE)
 p.txt(48,518,"last-mile connectivity diagnosis",24,True,WHITE)
 p.para(459,"A desktop-first, evidence-led workflow. Measure what happened, explain what the signals support, and give households a clear next step.",width=66,color=(.86,.91,.93))
 p.txt(48,320,"TEAM NAME",10,True,(.49,.88,.78));p.para(295,team,width=64,size=15,color=WHITE)
 p.txt(48,221,f"Prior baseline: {data['passed']}/{data['total']} controlled trials matched",13,True,WHITE)
 p.txt(48,102,"TECHNICAL REPORT  /  NOVEMBER 2026",10,True,(.73,.84,.85));out.append(p)
 p=Page();p.head("01 / Contents","Table of contents")
 entries=[("Problem description",3),("Solution proposed and escalation",4),("Optimizations and measured evidence",5),("Architecture and decision pseudocode",6),("Timeline of delivery",7),("References and conclusion",8)]
 for i,(s,n) in enumerate(entries):
  y=665-i*55;p.txt(48,y,s,15,True);p.txt(525,y,str(n),14,True,ACC);p.box(48,y-17,499,1,LINE)
 out.append(p)
 p=Page();p.head("02 / Problem","Problem description")
 y=p.label(y0,"The symptom does not tell you the cause")
 y=p.para(y,"A resident can report that the Internet is slow, but a peak download result does not distinguish a local link issue, a resolver failure, packet loss, or queue delay under load.")
 for title,body in [
 ("Signals that matter","Reachability, resolution, RTT and loss explain why a video call may fail even when a speed test looks good."),
 ("What can be established","A bounded test can show which observations support a likely cause. An ambiguous snapshot should stay inconclusive."),
 ("What must not be claimed","No unsupported attribution to radio interference, a damaged cable or the provider's internal fault. Different access media need verified field labels before comparing trends."),
 ("Who benefits","Households get a next step; support receives a timestamped summary and a repeatable measurement method rather than a vague report.")]:
  y=p.label(y,title);y=p.para(y,body)
 out.append(p)
 p=Page();p.head("03 / Solution","Solution proposed")
 p.flow(646,["01  Measure","02  Explain","03  Retest","04  Share"])
 y=p.para(615,"The Windows Electron desktop app is the primary diagnostic client. The Next.js and Expo clients can read the same bounded Python service. Pick a Fault is the Windows jury workflow: select a sealed card, inspect the independent verdict and evidence while its condition stays hidden, reveal the condition, retest clean, and export. Offline fixtures and read-only live probes stay separate.")
 y=p.label(y,"Escalation report template")
 for row in ["Run ID, UTC time, platform and measurement source","Symptoms and access label; mark whether self-reported or verified","Measurements with units, sample count, checks unavailable and their reasons","Diagnosis or Inconclusive; supporting and conflicting observations","Safe next action and comparable retest; export before sharing"]:
  p.txt(55,y,"- "+row,10);y-=21
 y=p.label(y-19,"Inconclusive example")
 p.para(y,"Both DNS lookups respond, one HTTPS target fails, and the gateway ignores ICMP. These tests do not locate the failure. Retry during symptoms, compare a wired or second-device run if possible, and attach both reports.")
 out.append(p)
 p=Page();p.head("04 / Evaluation","Optimizations and evidence")
 y=p.para(y0,"Each run uses independent control services, numbered packets and bounded payloads. The fault lab never changes the operating system or touches an external target. Removing the injected fault reruns the same instruments.")
 p.box(48,570,499,27,TINT)
 for x,s in [(57,"CASE"),(188,"BEFORE / CONTROL"),(349,"AFTER / FAULT")]:p.txt(x,579,s,9,True,ACC)
 reps={x["case"]:x for x in data["recorded_runs"] if x["round"]==1}
 clean=reps["control"]["raw"];cg=reps["congestion"]["raw"]
 def m(v):return f"{v:.1f}" if isinstance(v,(int,float)) else "n/a"
 rows=[("Gateway","TCP reply","No TCP reply"),("DNS","Positive A record",reps["dns"]["raw"]["dns_status"]),("Packet return",str(clean["received"])+"/10",str(reps["packet_loss"]["raw"]["received"])+"/10 returned"),("Loaded RTT",m(clean["loaded_ms"])+" ms",m(cg["loaded_ms"])+" ms")]
 for i,row in enumerate(rows):
  y=550-i*33
  for x,s in zip((57,188,349),row):p.txt(x,y,s,10,x==57)
  p.box(48,y-12,499,1,LINE)
 y=p.label(387,"Outcome")
 y=p.para(y,f'Prior baseline: {data["passed"]}/{data["total"]} measured controls matched in {data["rounds"]} Windows rounds. It did not include the compound or blind-flow cases. See the separate test report and raw evidence for the current build.')
 if fresh:
  p.txt(48,309,f"Current lab: {fresh['passed']}/{fresh['total']} measured, {fresh['replay']}/{fresh['total']} measurement-only replay; compound {fresh['ambiguous_passed']}/{fresh['ambiguous_total']}.",10,True,ACC)
 p.flow(265,["Baseline","Inject one fault","Compare signals","Clean retest"])
 p.para(222,"Compound or conflicting signals should yield Inconclusive instead of a forced single cause. These measured loopback checks do not establish population accuracy.")
 out.append(p)
 p=Page();p.head("05 / Design","Architecture and rules")
 p.flow(641,["Desktop / web","Python service","Rule engine","Report / history"])
 y=p.para(608,"Electron, Next.js and Expo send a run request; the local Python agent measures a fixture, the loopback lab or the host interface. Reports default to local storage. Optional Firebase sync is owner-scoped and never required for the demo.")
 y=p.label(y,"Pseudocode for mentor demo")
 snippets=["observations = measure(mode, consented_scope)",
 "if evidence_missing_or_conflicting: return INCONCLUSIVE",
 "if gateway_unreachable and controls_pass: show GATEWAY",
 "else if DNS_error and gateway_pass: show DNS",
 "else if missing_numbered_packets: show LOSS",
 "else if loaded_RTT - idle_RTT > lab_threshold: show CONGESTION",
 "else: report NO_FAULT_OBSERVED if all required checks pass",
 "attach measurements, reasoning, limitations and retest link"]
 p.box(48,y-147,499,169,TINT)
 for i,s in enumerate(snippets):p.txt(58,y-i*18,s,10,False,INK)
 p.para(y-185,"These rules are scoped to the lab and are not universal ISP thresholds. Live mode uses an independent, more conservative rule set. No report publishes local IPs, Wi-Fi names, or hardware addresses.")
 out.append(p)
 p=Page();p.head("06 / Delivery","Timeline of delivery")
 y=y0
 for title,body in [("01  Read and map the rubric","Extract the event PS and official report structure; use the desktop as the reference client."),
 ("02  Build measurements and interfaces","Add repeatable socket controls, live read-only checks, evidence views, retest, and exports."),
 ("03  Validate on Windows","Prior baseline: three rounds of five measured controls. Record blind cases, compound ambiguity, retest and export separately; live checks remain read-only."),
 ("04  Rehearse with the mentor","On Windows, let the jury choose a sealed case. Read the measured verdict and evidence, reveal the condition, then compare a clean retest and export a redacted support report."),
 ("05  Before submission","Confirm the official team name and repository destination. Cross-check the separate test record before quoting results. Gemini is optional; no live key is assumed.")]:
  y=p.label(y,title);y=p.para(y,body)-20
 out.append(p)
 p=Page();p.head("07 / Next steps","References and conclusion")
 y=p.label(y0,"References")
 for s in ["AIORI-3 Hackathon index and official PS-015 problem statement PDF.",
 "AIORI Proposed-structure-hackathon.pdf and regional venue guidelines.",
 "RFC 2330, Framework for IP Performance Metrics, RFC Editor.",
 "Python standard library; Next.js; Electron; Expo; Firebase."]:
  y=p.para(y,s)
 y=p.label(y-22,"Conclusion")
 y=p.para(y,"NetDoctor gives someone with a slow connection a defensible next step, not a speculative root cause. The four controlled fault conditions can be demonstrated locally and separated from uncategorized field evidence.")
 y=p.label(y-13,"Next validation")
 p.para(y,"The field pilot is a design only; no volunteer endpoints yet. Obtain consent, verify access media, repeat measurements, and document the endpoint and traffic budget before measuring broadband throughput or loaded latency.")
 out.append(p)
 for i,p in enumerate(out[1:],2):p.foot(i)
 return out

def pdf(path,pp):
 objects=[b"<< /Type /Catalog /Pages 2 0 R >>",b"",b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"]
 kids=[]
 for p in pp:
  n=len(objects)+1; kids.append(f"{n} 0 R")
  objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {n+1} 0 R >>".encode("ascii"))
  raw="\n".join(p.ops).encode("cp1252")
  objects.append(f"<< /Length {len(raw)} >>\nstream\n".encode("ascii")+raw+b"\nendstream")
 objects[1]=(f"<< /Type /Pages /Count {len(kids)} /Kids [{' '.join(kids)}] >>").encode()
 content=bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"); offsets=[0]
 for i,obj in enumerate(objects,1):
  offsets.append(len(content));content+=f"{i} 0 obj\n".encode()+obj+b"\nendobj\n"
 offset=len(content)
 content+=f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode()
 for n in offsets[1:]:content+=f"{n:010d} 00000 n \n".encode()
 content+=f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{offset}\n%%EOF\n".encode()
 path.write_bytes(content)
if __name__=="__main__":
 p=argparse.ArgumentParser(description=__doc__); p.add_argument("--team",default="Official team name pending"); p.add_argument("--blind-evidence",type=Path)
 a=p.parse_args();base=Path(__file__).parent
 data=json.loads((base/"control-evaluation.json").read_text(encoding="utf8"))
 from jury_evidence import load_summary
 fresh=load_summary(a.blind_evidence) if a.blind_evidence else None
 pdf(base/"NetDoctor-PS015-Technical-Report.pdf",pages(a.team,data,fresh))
