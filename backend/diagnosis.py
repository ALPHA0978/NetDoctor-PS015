"""Scenario definitions and explainable evidence report generation."""
import datetime as dt
import statistics
import uuid
import lab
from probes import TARGETS

SCENARIOS = {
 "healthy": ("Healthy baseline", "Local gateway, name resolution, and both external services respond."),
 "wifi": ("Local Wi-Fi instability", "The gateway shows intermittent loss even though Internet services respond."),
 "dns": ("DNS failure · measured lab", "A local DNS resolver returns SERVFAIL while control probes pass."),
 "gateway": ("Gateway unreachable · measured lab", "A local gateway surrogate is unreachable while independent controls pass."),
 "packet_loss": ("Induced packet loss · measured lab", "A loopback responder drops three numbered datagrams."),
 "congestion": ("Congestion · measured lab", "A bounded local transfer queues parallel latency probes."),
 "ambiguous": ("Conflicting signals — measured lab", "The gateway surrogate does not answer and the controlled DNS resolver returns SERVFAIL."),
 "control": ("Clean retest · measured lab", "Run the same instruments with no injected fault."),
 "upstream": ("Beyond the local gateway", "Gateway and DNS respond; two independent external services fail."),
 "mixed": ("Mixed evidence", "Gateway probes are filtered and one external service fails."),
 "offline": ("No usable network route", "No default route or working external probe is available.")
}
# These static illustrative fixtures are separate from the measured socket lab.
FIXTURES = {
 "healthy": (True, [4,5,6,5], [20,30], [74,88], True),
 "wifi": (True, [46,None,221,178], [44,60], [160,240], True),
 "dns": (True,[4,6,5,4],[None,None],[None,None],True),
 "upstream": (True,[3,4,6,5],[24,31],[None,None],False),
 "mixed": (True,[None,None,None,None],[20,30],[None,101], True),
 "offline": (False,[],[None,None],[None,None],False)
}
OUTCOMES={
 "healthy":("No issue observed","high","These checks succeeded now. Intermittent faults and speed issues are not ruled out.",
   ["Repeat while symptoms are happening.","Save this result as a baseline for comparison."]),
 "local_wifi":("Likely issue on the local link","medium","Replies from the local gateway were inconsistent. That suggests a problem near the device or gateway, but signal or interference was not measured.",
   ["Move closer to the router and repeat the same test.","If possible, compare the same device over Ethernet."]),
 "local_link":("Likely local link issue","medium","The local gateway answered inconsistently. Check the link before attributing the problem to the provider.",
   ["Reconnect the cable or network and retest.","Compare another device on the same network."]),
 "dns":("Likely DNS resolution issue","medium","DNS lookups failed while a fixed external IP accepted a TCP connection. This suggests, but does not prove, a name-resolution problem.",
   ["Reconnect and rerun before changing settings.","Ask your administrator or provider to check your configured DNS."]),
 "upstream":("Connection problem beyond gateway suspected","medium","Local replies and DNS worked, but both external HTTPS probes failed. A firewall, VPN, captive portal, or upstream fault could explain it.",
   ["If allowed, retry without the VPN or on a second trusted device.","Share the report with support if the pattern repeats."]),
 "offline":("No usable route observed","medium","No supported default IPv4 gateway was found and the external checks did not respond. This is not proof that every interface is offline.",
   ["Confirm Wi-Fi or Ethernet is connected and a sign-in page is not waiting.","Reconnect and retest."]),
 "inconclusive":("Not enough evidence to isolate the cause","low","Some checks were missing or disagree. A single failed target or blocked ping is not enough to blame the router or provider.",
   ["Retry on a trusted connection during the problem.","If the issue continues, compare a second device or a wired run."])
}

def classify(route,local,dns,wan,ip,access):
 received=[n for n in local if n is not None]
 d=sum(v is not None for v in dns); w=sum(v is not None for v in wan)
 if route and len(local)>=3 and received and (len(received)<len(local) or statistics.median(received)>=65):
  return "local_wifi" if access=="wifi" else "local_link"
 if not route and not w and ip is False and not d: return "offline"
 if not d and ip is True and not w: return "dns"
 if route and len(received)>=3 and d==2 and not w: return "upstream"
 if route and len(local)>=3 and len(received)==len(local) and d==2 and w==2: return "healthy"
 return "inconclusive"


def controlled_outcome(payload):
 fault=payload["scenario"]
 m=lab.run(fault)
 # The harness label configures the lab only; diagnosis receives observations, not the label.
 code=lab.classify(m)
 causes={
  "gateway_unreachable":("Gateway unreachable in the lab","high","The gateway surrogate failed to respond while the independent control services still responded.",["Restore the lab gateway by choosing the clean control, then retest.","For a real network, check association, power and local reachability before calling support."]),
  "dns":("DNS failure in the lab","high","The controlled resolver responded SERVFAIL even though gateway and packet probes responded.",["Restore the lab resolver with the clean control, then retest.","In a real incident, compare repeated DNS tests and share the error code with support."]),
  "packet_loss":("Packet loss reproduced in the lab","high","Some numbered packets did not return while gateway and DNS probes responded.",["Remove the lab loss using the clean control, then retest.","For real faults, compare wired and wireless runs before assigning responsibility."]),
  "congestion":("Congestion under load reproduced in the lab","high","Latency increased while a known, bounded load occupied the simulated link.",["Remove the lab queue condition with the clean control, then retest.","For real faults, compare idle and active measurements to identify a reproducible symptom."]),
  "healthy":("No fault observed in this lab run","high","The gateway and DNS replied, every packet returned, and loaded latency stayed near baseline.",["Use this clean control to verify recovery from a prior fault."]),
  "inconclusive":("Inconclusive: no single cause isolated","low","Multiple failed or missing checks prevent this run from singling out one cause. Review the gateway and DNS evidence before making any changes.",["Run the clean control for comparison. If real readings remain mixed, share them with support rather than changing settings."])
 }
 title,confidence,summary,actions=causes[code]
 rows=[]
 def put(k,label,value,unit,status,detail):
  rows.append(dict(id=k,label=label,value=value,unit=unit,status=status,detail=detail))
 put("gateway","Gateway surrogate",m["gateway_ms"],"ms","pass" if m["gateway_ms"] is not None else "fail","TCP reply from a loopback service that models gateway reachability; not an actual router.")
 put("dns","Controlled DNS",m["dns_ms"],"ms","pass" if m["dns_status"]=="response" else "fail",m["dns_status"]+"; DNS datagram response from a disposable loopback resolver.")
 put("loss","Packet loss",m["loss_pct"],"%","warn" if m["loss_pct"] else "pass",f'{m["received"]}/{m["sent"]} numbered datagrams returned.')
 put("idle","Idle median round-trip",m["idle_ms"],"ms","pass" if m["idle_ms"] is not None else "unknown","Three TCP application round-trip samples without load.")
 delta=round(m["loaded_ms"]-m["idle_ms"],3) if m["loaded_ms"] is not None and m["idle_ms"] is not None else None
 put("loaded","Loaded median round-trip",m["loaded_ms"],"ms","unknown" if delta is None else ("warn" if delta>100 else "pass"),f"Three concurrent probes under a 512 KiB bounded transfer; loaded minus idle = {delta} ms." if delta is not None else "No valid loaded-versus-idle comparison.")
 put("jitter","Loaded latency range",m["loaded_jitter_ms"],"ms","pass" if m["loaded_jitter_ms"] is not None else "unknown","Maximum minus minimum RTT during the local load; exploratory jitter estimate.")
 put("throughput","Controlled throughput",m["throughput_mbps"],"Mbps","pass" if m["bytes"]==512*1024 else "unknown",f'{m["bytes"]} bytes received over loopback. This is not broadband speed.')
 return {"id":str(uuid.uuid4()),"mode":"demo","scenario":fault,"access":payload.get("access","unknown"),
  "created_at":dt.datetime.now(dt.timezone.utc).isoformat(),
  "diagnosis":{"code":code,"title":title,"confidence":confidence,"summary":summary},
  "measurements":rows,
  "evidence":[f'Gateway reply: {"yes" if m["gateway_ms"] is not None else "no"}; DNS result: {m["dns_status"]}.',
   f'Packet return count: {m["received"]}/{m["sent"]}.',
   f'Idle median {m["idle_ms"]} ms; loaded median {m["loaded_ms"]} ms.'],
  "actions":actions,"limitations":["CONTROLLED LOOPBACK: these are real socket measurements against a local model, not field measurements.",
   "No changes were made to router, firewall, adapter, or system DNS settings.",
   "The lab does not identify Wi-Fi interference, damaged cables, or internal ISP faults."],
  "provenance":{"schema_version":"1.0","ruleset":"netdoctor-2026.11","source":"controlled-loopback","raw":m}}

def build_report(payload, observation=None, measure=None, *, fixture_only=False):
 mode=payload.get("mode"); access=payload.get("access","unknown"); scenario=payload.get("scenario")
 if mode not in ("demo","live"): raise ValueError("Choose demo or live mode.")
 if access not in ("wifi","ethernet","unknown"): raise ValueError("Invalid access type.")
 if mode=="demo":
  scenario=scenario or "healthy"
  if not fixture_only and scenario in ("gateway","dns","packet_loss","congestion","control","ambiguous"):
   return controlled_outcome({**payload,"scenario":scenario})
  if scenario not in FIXTURES: raise ValueError("Unknown controlled scenario.")
  if scenario=="wifi": access="wifi"
  route,local,dns,wan,ip=FIXTURES[scenario]
 else:
  scenario=None
  route,local,dns,wan,ip=observation if observation is not None else measure()
 received=[n for n in local if n is not None]
 med=round(statistics.median(received),1) if received else None
 loss=round(100*(len(local)-len(received))/len(local),1) if local else None
 spread=round(max(received)-min(received),1) if len(received)>=2 else None
 d=sum(v is not None for v in dns); w=sum(v is not None for v in wan)
 code=classify(route,local,dns,wan,ip,access)
 title,confidence,summary,actions=OUTCOMES[code]
 rows=[]
 def add(key,label,value,unit,status,detail):
  rows.append(dict(id=key,label=label,value=value,unit=unit,status=status,detail=detail))
 src="Controlled fixture" if mode=="demo" else "Measured on the device running the Python service"
 add("gateway","Local route","Found" if route else "Not observed","","pass" if route else "unknown",src+"; private IPv4 gateway only.")
 add("latency","Gateway median latency",med,"ms","unknown" if med is None else ("warn" if med>=65 else "pass"),"Median of successful ICMP replies. Missing replies can mean filtering.")
 add("loss","Gateway probe loss",loss,"%","unknown" if not received else ("warn" if loss else "pass"),f"{len(received)}/{len(local)} replies; four requests at most.")
 add("spread","Gateway latency range",spread,"ms","unknown" if spread is None else ("warn" if spread>=40 else "pass"),"Maximum minus minimum of successful gateway samples; not an Internet jitter measurement.")
 for i,host in enumerate(TARGETS):
  add(f"dns_{i+1}",f"DNS: {host}",dns[i],"ms","pass" if dns[i] is not None else "fail","System resolver; cached results are possible.")
  add(f"https_{i+1}",f"HTTPS: {host}",wan[i],"ms","pass" if wan[i] is not None else "fail","TLS-validated HEAD response. This is reachability, not throughput.")
 add("fixed_ip","Fixed-IP TCP probe","Reachable" if ip is True else ("Not reached" if ip is False else "Unavailable"),"","pass" if ip is True else "unknown","One TCP connection to a fixed public endpoint, without DNS.")
 return {
  "id":str(uuid.uuid4()),"mode":mode,"scenario":scenario,"access":access,
  "created_at":dt.datetime.now(dt.timezone.utc).isoformat(),
  "diagnosis":{"code":code,"title":title,"confidence":confidence,"summary":summary},
  "measurements":rows,
  "evidence":[f"Local gateway: {len(received)} of {len(local)} replies." if local else "No gateway samples.",
    f"DNS lookups: {d} of 2. Secure web probes: {w} of 2.",
    "Fixed external IP accepted a connection." if ip is True else "Fixed external IP reachability was not confirmed."],
  "actions":actions,
  "limitations":[("SIMULATED: these values are not measurements from your network." if mode=="demo" else "Live values describe the Python measurement host, not the browser or phone that opened it."),
    "Confidence labels describe supporting signals, not statistically calibrated probabilities.",
    "IPv6, radio signal strength, ISP segment ownership, and broadband speed are not measured.",
    "A brief sample may miss intermittent faults. A nonresponse can be filtering or an unavailable endpoint."],
  "provenance":{"schema_version":"1.0","ruleset":"netdoctor-2026.11","source":"fixture" if mode=="demo" else "python-host","gateway_sample_ms":local}
 }

