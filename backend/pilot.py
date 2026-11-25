"""Opt-in, bounded collection for a consented NetDoctor volunteer pilot.

Each endpoint collects locally, and manually shares the redacted JSONL only after review.
Pass a pseudonymous endpoint label; do not use a name, IP, SSID or address.
"""
import argparse, collections, json, pathlib, re, statistics, time
import server

MEDIA=("fiber","cable","dsl","fixed-wireless","cellular","satellite","other","unknown")
def baseline(args):
 if not re.fullmatch(r"(?:site|home|endpoint)-[A-Za-z0-9]{3,16}",args.endpoint):
  raise SystemExit("Use a pseudonym like home-A04. Do not use names or addresses.")
 if not 1<=args.count<=12 or not 60<=args.interval<=3600:
  raise SystemExit("Bounded schedule: 1-12 samples and 60-3600 seconds between starts.")
 if args.verification=="observer-verified" and args.medium=="unknown":
  raise SystemExit("Record a specific access medium before labeling it verified.")
 with args.out.open("x",encoding="utf8") as f:
  start=time.monotonic()
  for i in range(args.count):
   if i: time.sleep(max(0,start+i*args.interval-time.monotonic()))
   r=server.outcome({"mode":"live","access":args.link})
   out={"endpoint":args.endpoint,"medium":args.medium,"verification":args.verification,
        "link":args.link,"id":r["id"],"time_utc":r["created_at"],
        "diagnosis_code":r["diagnosis"]["code"],
        "measurements":{m["id"]:m["value"] for m in r["measurements"] if m["id"] in ("latency","loss","spread","dns_1","dns_2","https_1","https_2")}}
   f.write(json.dumps(out,separators=(",",":"))+"\n");f.flush()
   print("Recorded",i+1,"of",args.count,flush=True)
def compare(paths):
 groups=collections.defaultdict(dict); excluded=0
 for p in paths:
  with p.open(encoding="utf8") as f:
   for line in f:
    row=json.loads(line)
    if row.get("verification")!="observer-verified":
     excluded+=1;continue
    if row.get("medium") not in MEDIA or row["medium"]=="unknown":excluded+=1;continue
    groups[(row["medium"],row["link"])][row["id"]]=row
 out=[]
 for (medium,link),runs in sorted(groups.items()):
  rows=list(runs.values())
  def numeric(key):
   return [r["measurements"][key] for r in rows if type(r["measurements"].get(key)) in (int,float)]
  pooled={}
  for key in ("latency","loss","spread","dns_1","dns_2","https_1","https_2"):
   vals=numeric(key)
   pooled[key]={"n":len(vals),"median":statistics.median(vals) if vals else None}
  out.append({"medium":medium,"local_link":link,"runs":len(rows),
              "endpoints":len({r["endpoint"] for r in rows}),"metrics":pooled})
 return {"groups":out,"excluded_unverified_runs":excluded,
         "scope":"Descriptive pilot results only; no causal ranking, RF attribution, or broadband speed comparison."}
if __name__=="__main__":
 p=argparse.ArgumentParser(description=__doc__)
 sub=p.add_subparsers(dest="cmd",required=True)
 c=sub.add_parser("collect")
 c.add_argument("--consent",action="store_true",required=True,help="I consent to run these probes from this endpoint.")
 c.add_argument("--endpoint",required=True);c.add_argument("--medium",choices=MEDIA,default="unknown")
 c.add_argument("--verification",choices=("unverified","self-reported","observer-verified"),default="unverified")
 c.add_argument("--link",choices=("unknown","ethernet","wifi"),default="unknown")
 c.add_argument("--count",type=int,default=3);c.add_argument("--interval",type=int,default=120)
 c.add_argument("--out",type=pathlib.Path,required=True)
 a=sub.add_parser("compare")
 a.add_argument("paths",nargs="+",type=pathlib.Path)
 args=p.parse_args()
 if args.cmd=="collect": baseline(args)
 else:print(json.dumps(compare(args.paths),indent=2))
