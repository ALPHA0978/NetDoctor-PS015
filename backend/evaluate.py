"""Repeat the nominal and injected controls, retaining actual evidence per trial."""
import argparse, datetime, json, pathlib, platform, time, random, statistics
import server, lab
EXPECTED={"control":"healthy","gateway":"gateway_unreachable","dns":"dns","packet_loss":"packet_loss","congestion":"congestion","ambiguous":"inconclusive"}
def run(rounds, seed=150):
 rows=[]
 rng=random.Random(seed)
 for i in range(rounds):
  cases=list(EXPECTED.items())
  rng.shuffle(cases)
  for case,expected in cases:
   start=time.perf_counter()
   r=server.outcome({"mode":"demo","scenario":case})
   duration_ms=round((time.perf_counter()-start)*1000,1)
   raw=r["provenance"]["raw"]
   actual=r["diagnosis"]["code"]
   rows.append({"round":i+1,"case":case,"expected":expected,"actual":actual,
     "matched":expected==actual,"report_id":r["id"],"source":r["provenance"]["source"],
     "measurement_only_replay_matches":lab.classify(raw)==actual,"duration_ms":duration_ms,"raw":raw})
 return {"evaluated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
   "environment":platform.system(),"rounds":rounds,"order_seed":seed,"recorded_runs":rows,
   "median_duration_ms":round(statistics.median(row["duration_ms"] for row in rows),1),
   "passed":sum(r["matched"] for r in rows),"total":len(rows)}
if __name__=="__main__":
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument("--rounds",type=int,default=3);p.add_argument("--out",type=pathlib.Path)
 a=p.parse_args()
 if not 1<=a.rounds<=20:p.error("Choose 1 to 20 rounds.")
 r=run(a.rounds)
 if a.out:a.out.write_text(json.dumps(r,indent=2)+"\n",encoding="utf8")
 print(f'{r["passed"]}/{r["total"]} controlled runs matched on {r["environment"]}')
 for record in r["recorded_runs"]: print(record["round"],record["case"],record["actual"],"PASS" if record["matched"] else "FAIL")
 raise SystemExit(0 if r["passed"]==r["total"] and all(x["measurement_only_replay_matches"] for x in r["recorded_runs"]) else 1)
