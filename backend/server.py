"""NetDoctor PS-015: privacy-first, bounded diagnostics on the measurement host."""
import argparse, http.client, ipaddress, json, os, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import gemini_evidence
import lab  # re-exported for testing and fixture tooling

from diagnosis import FIXTURES, SCENARIOS, build_report, classify
from probes import measure

def outcome(payload, observation=None):
 return build_report(payload, observation=observation, measure=measure)

ORIGINS={"http://localhost:3000","http://127.0.0.1:3000","http://localhost:8081","http://127.0.0.1:8081"}
ORIGINS.update(x.strip() for x in os.getenv("NETDOCTOR_ORIGINS","").split(",") if x.strip() and x.strip()!="*")
running=threading.BoundedSemaphore(2)
class Handler(BaseHTTPRequestHandler):
 def log_message(self, *args): pass
 def allowed_origin(self):
  o=self.headers.get("Origin")
  return o if o in ORIGINS else None
 def send_json(self, status, data=None):
  raw=json.dumps(data,ensure_ascii=False,allow_nan=False).encode("utf-8") if data is not None else b""
  self.send_response(status)
  self.send_header("Content-Type","application/json; charset=utf-8")
  self.send_header("Content-Length",str(len(raw)))
  self.send_header("Cache-Control","no-store")
  origin=self.allowed_origin()
  if origin:
   self.send_header("Access-Control-Allow-Origin",origin)
   self.send_header("Vary","Origin")
  if self.command=="OPTIONS":
   self.send_header("Access-Control-Allow-Methods","GET, POST, OPTIONS")
   self.send_header("Access-Control-Allow-Headers","Content-Type")
  self.end_headers()
  if raw: self.wfile.write(raw)
 def do_OPTIONS(self): self.send_json(204 if self.allowed_origin() else 403)
 def do_GET(self):
  if self.path=="/health": self.send_json(200,{"status":"ok","name":"NetDoctor","version":"1.0","measurement_host":"python","gemini_enabled":gemini_evidence.configured()})
  elif self.path=="/scenarios": self.send_json(200,[{"id":i,"title":v[0],"description":v[1]} for i,v in SCENARIOS.items()])
  else: self.send_json(404,{"error":"Not found."})
 def do_POST(self):
  if self.path not in ("/diagnose","/explain"): return self.send_json(404,{"error":"Not found."})
  if self.headers.get("Origin") and not self.allowed_origin(): return self.send_json(403,{"error":"Browser origin not allowed."})
  if self.headers.get_content_type()!="application/json": return self.send_json(415,{"error":"Use application/json."})
  if self.path=="/explain":
   origin=self.headers.get("Origin")
   if not ipaddress.ip_address(self.client_address[0]).is_loopback or (origin and not origin.startswith(("http://localhost:","http://127.0.0.1:"))):
    return self.send_json(403,{"error":"Gemini can only be used from the measurement PC."})
   if not gemini_evidence.configured():
    return self.send_json(503,{"error":"Gemini is not configured. The measured report has not changed."})
  try:
   n=int(self.headers.get("Content-Length","0"))
   if not 1<=n<=4096: return self.send_json(413,{"error":"Request too large or empty."})
   self.connection.settimeout(5)
   body=json.loads(self.rfile.read(n))
   if self.path=="/explain":
    if not isinstance(body,dict) or set(body)!={"run_id","consent"} or body["consent"] is not True or not isinstance(body["run_id"],str) or not 1<=len(body["run_id"])<=64:
     return self.send_json(400,{"error":"A measured run ID and explicit permission are required."})
    try:return self.send_json(200,gemini_evidence.explain(body["run_id"]))
    except KeyError:return self.send_json(404,{"error":"Run a new measured check on this PC before asking Gemini."})
    except (ValueError,OSError,RuntimeError,AttributeError,TypeError,http.client.HTTPException):
     return self.send_json(502,{"error":"Gemini did not return a usable explanation. Your measured result is unchanged."})
   if not isinstance(body,dict) or set(body)-{"mode","scenario","access"} or any(not isinstance(v,str) for v in body.values()):
    raise ValueError("Only string mode, scenario and access fields are supported.")
   if not running.acquire(blocking=False): return self.send_json(429,{"error":"Measurements busy. Try again when the current check finishes."})
   try: result=outcome(body)
   finally: running.release()
   gemini_evidence.record(result)
   return self.send_json(200,result)
  except (ValueError,UnicodeError,TimeoutError) as e:
   return self.send_json(400,{"error":str(e) if type(e) is ValueError else "Invalid request."})
if __name__=="__main__":
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument("--host",default="127.0.0.1"); p.add_argument("--port",default=8765,type=int)
 a=p.parse_args()
 try: bind=ipaddress.IPv4Address(a.host)
 except ValueError: p.error("Bind only to loopback or a specific private IPv4 interface.")
 if not bind.is_private or bind.is_unspecified or bind.is_multicast or bind.is_link_local:
  p.error("Bind only to loopback or a specific private IPv4 interface; never expose this service publicly.")
 service=ThreadingHTTPServer((a.host,a.port),Handler)
 print(f"NetDoctor ready at http://{a.host}:{service.server_port}",flush=True)
 try: service.serve_forever()
 except KeyboardInterrupt: pass
 finally: service.server_close()
