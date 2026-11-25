"""Build the 1-page Windows jury runbook PDF from retained lab evidence."""
from argparse import ArgumentParser
from pathlib import Path
from make_report import Page, pdf, ACC, MUTED, TINT
from jury_evidence import load_summary

def build(summary):
 p=Page();p.head("AIORI-3  /  SMART CITIES  /  PS-015","NetDoctor jury runbook")
 p.txt(48,695,"WINDOWS DESKTOP  /  ISOLATED LOOPBACK  /  TEAM NAME PENDING",9,True,ACC)
 y=662
 steps=[
  ("01  Pick","Open Pick a Fault, confirm local Python, then ask the judge to choose a sealed card."),
  ("02  Measure","Read the independent verdict and observations while the injected condition remains hidden."),
  ("03  Reveal","Reveal the condition. Compare it to the verdict, explain the evidence, then run the clean retest."),
  ("04  Handoff","Export the redacted PDF or JSON. Point to run ID, timestamp, mode, observations and safe next step.")
 ]
 for k,b in steps:
  p.txt(48,y,k,12,True);y=p.para(y-17,b,width=91,size=10)-6
 p.box(48,404,499,26,TINT);p.txt(58,412,"SIX CONDITIONS, SIX INTERPRETATIONS",9,True,ACC)
 for i,(k,b) in enumerate([
   ("Clean","No fault observed in these conditions"),("Gateway","No surrogate response"),
   ("DNS","Resolver failure"),("Packet loss","Numbered replies below the sent count"),
   ("Congestion","Increased loaded versus idle RTT"),("Compound","Conflicting observations: Inconclusive")]):
  x=48+(i%2)*252;z=387-(i//2)*45
  p.txt(x,z,k,11,True);p.txt(x,z-16,b,9,color=MUTED)
 if summary:
  msg=f"Measured Windows lab: {summary['passed']}/{summary['total']} matched; compound {summary['ambiguous_passed']}/{summary['ambiguous_total']} Inconclusive."
 else:
  msg="Prior Windows loopback baseline: 15/15. No blind-build result reported here."
 p.txt(48,237,msg,11,True,ACC)
 p.para(212,"Lab results are not field accuracy. Live probes are separate and read-only. Do not infer cable damage, Wi-Fi interference or ISP-internal faults. Field pilot design only: no volunteer endpoints yet. Gemini is optional; no live key is needed.",width=90,size=10)
 p.para(135,"Fallback: if local measurement is unavailable, show labeled recorded evidence or fixtures and say it is not a fresh run. Use the separate test report for UI, retest and export verification.",width=91,size=10)
 p.foot(1);return p

if __name__=="__main__":
 a=ArgumentParser(description=__doc__);a.add_argument("--blind-evidence",type=Path)
 o=a.parse_args();base=Path(__file__).parent
 pdf(base/"NetDoctor-PS015-Jury-Runbook.pdf",[build(load_summary(o.blind_evidence) if o.blind_evidence else None)])

