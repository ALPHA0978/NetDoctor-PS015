"""Summarize verified measured evaluator JSON; UI checks are not inferred."""
from pathlib import Path
import json
from collections import Counter
def load_summary(p:Path):
 d=json.loads(p.read_text(encoding="utf-8-sig")); a=d["recorded_runs"]
 expected={"control","gateway","dns","packet_loss","congestion","ambiguous"}
 count=Counter(r["case"] for r in a); rounds=d["rounds"]
 if set(count)!=expected or any(n!=rounds for n in count.values()):
  raise ValueError("Expected one of each of the six controlled cases per round")
 if any({r["case"] for r in a if r["round"]==i}!=expected for i in range(1,rounds+1)):
  raise ValueError("Incomplete or duplicated case record in at least one round")
 if d["environment"]!="Windows" or any(r["source"]!="controlled-loopback" for r in a):
  raise ValueError("Only Windows controlled-loopback evidence is applicable")
 if not all(r.get("matched") is (r['expected']==r['actual']) for r in a):
  raise ValueError("At least one matched flag contradicts the verdict")
 amb=[r for r in a if r["case"]=="ambiguous"]
 out={"passed":sum(r["matched"] is True for r in a),"total":len(a),"replay":sum(r["measurement_only_replay_matches"] is True for r in a),"rounds":rounds,
      "ambiguous_passed":sum(r["expected"]==r["actual"]=="inconclusive" for r in amb),"ambiguous_total":len(amb)}
 if (d["passed"],d["total"])!=(out["passed"],out["total"]):raise ValueError("Totals contradict retained results")
 return out

