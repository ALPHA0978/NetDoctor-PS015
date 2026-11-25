import contextlib, json, threading, unittest, urllib.request
from unittest.mock import patch
from urllib.error import HTTPError
import server

class Rules(unittest.TestCase):
 def test_lab_matrix(self):
  expect={"healthy":"healthy","wifi":"local_wifi","upstream":"upstream","mixed":"inconclusive","offline":"offline"}
  for scenario,code in expect.items():
   with self.subTest(scenario=scenario):
    r=server.outcome({"mode":"demo","scenario":scenario})
    self.assertEqual(r["diagnosis"]["code"],code)
    self.assertEqual(r["provenance"]["source"],"fixture")
    self.assertIn("SIMULATED",r["limitations"][0])
    self.assertEqual(len({m["id"] for m in r["measurements"]}),len(r["measurements"]))
 def test_all_gateway_probes_missing_does_not_blame_router(self):
  self.assertEqual(server.classify(True,[None]*4,[12,24],[67,88],True,"wifi"),"inconclusive")
 def test_one_external_target_failure_does_not_blame_isp(self):
  self.assertEqual(server.classify(True,[3,4,5,6],[12,24],[None,88],True,"wifi"),"inconclusive")
 def test_no_two_dns_plus_ip_needs_abstention_on_incomplete_ip(self):
  self.assertEqual(server.classify(True,[3,4,5,6],[None,None],[None,None],None,"wifi"),"inconclusive")
 def test_controlled_fixture_cannot_leak_into_live_mode(self):
  with patch.object(server,"measure",return_value=(False,[],[None,None],[None,None],None)) as live:
   r=server.outcome({"mode":"live","scenario":"wifi"})
   live.assert_called_once_with()
   self.assertIsNone(r["scenario"])
   self.assertEqual(r["diagnosis"]["code"],"inconclusive")
   self.assertEqual(r["provenance"]["source"],"python-host")
 def test_live_report_does_not_include_local_credential_data(self):
  r=server.outcome({"mode":"live"},(True,[4,5,6,7],[22,28],[70,80],True))
  raw=json.dumps(r)
  self.assertNotIn("192.168.",raw)
  self.assertNotIn("MAC address",raw)
  self.assertEqual(r["diagnosis"]["code"],"healthy")
 def test_secure_server_default_hosts_and_input_validation(self):
  for req in ({"mode":"admin"},{"mode":"demo","access":"invented"},{"mode":"demo","scenario":"invented"}):
   with self.subTest(req=req),self.assertRaises(ValueError): server.outcome(req)

class MeasuredLab(unittest.TestCase):
 def test_all_four_faults_and_control(self):
  cases={"gateway":"gateway_unreachable","dns":"dns","packet_loss":"packet_loss","congestion":"congestion","control":"healthy"}
  for scenario, expected in cases.items():
   with self.subTest(scenario=scenario):
    r=server.outcome({"mode":"demo","scenario":scenario})
    self.assertEqual(r["diagnosis"]["code"],expected)
    self.assertEqual(r["provenance"]["source"],"controlled-loopback")
    raw=r["provenance"]["raw"]
    self.assertEqual(raw["bytes"],512*1024)
    if scenario=="gateway": self.assertIsNone(raw["gateway_ms"])
    if scenario=="dns": self.assertEqual(raw["dns_status"],"SERVFAIL")
    if scenario=="packet_loss": self.assertEqual((raw["sent"],raw["received"],raw["loss_pct"]),(10,7,30))
    if scenario=="congestion": self.assertGreater(raw["loaded_ms"]-raw["idle_ms"],100)
 def test_fixture_generation_never_runs_dns_lab(self):
  import diagnosis
  with patch.object(server.lab,"run") as measured:
   r=diagnosis.build_report({"mode":"demo","scenario":"dns"},fixture_only=True)
  measured.assert_not_called()
  self.assertEqual(r["provenance"]["source"],"fixture")
  self.assertEqual(r["diagnosis"]["code"],"dns")
 def test_compound_fault_is_measured_and_abstains(self):
  r=server.outcome({"mode":"demo","scenario":"ambiguous"})
  raw=r["provenance"]["raw"]
  self.assertEqual(r["provenance"]["source"],"controlled-loopback")
  self.assertIsNone(raw["gateway_ms"])
  self.assertEqual(raw["dns_status"],"SERVFAIL")
  self.assertEqual((raw["sent"],raw["received"]),(10,10))
  self.assertEqual(raw["bytes"],512*1024)
  self.assertEqual(r["diagnosis"]["code"],"inconclusive")
 def test_harness_label_cannot_change_diagnosis_for_same_measurements(self):
  expected={"gateway_ms":4,"dns_ms":1,"dns_status":"response","sent":10,"received":10,
            "loss_pct":0,"idle_ms":1,"loaded_ms":2,"loaded_jitter_ms":0,"bytes":512*1024,"throughput_mbps":20}
  with patch.object(server.lab,"run",return_value=expected):
   for label in ("gateway","dns","packet_loss","congestion","ambiguous","control"):
    self.assertEqual(server.outcome({"mode":"demo","scenario":label})["diagnosis"]["code"],"healthy")
  self.assertEqual(server.lab.classify(dict(expected,dns_status="SERVFAIL")),"dns")
 def test_invalid_signals_keep_inconclusive(self):
  raw={"gateway_ms":None,"dns_status":"timeout","received":0,"sent":10}
  self.assertEqual(server.lab.classify(raw),"inconclusive")

class Http(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.service=server.ThreadingHTTPServer(("127.0.0.1",0),server.Handler)
  cls.worker=threading.Thread(target=cls.service.serve_forever,daemon=True)
  cls.worker.start()
  cls.root=f"http://127.0.0.1:{cls.service.server_port}"
 @classmethod
 def tearDownClass(cls):
  cls.service.shutdown();cls.worker.join(2);cls.service.server_close()
 def req(self,path,body=None,headers=None,verb=None):
  req=urllib.request.Request(self.root+path,body,headers or {},method=verb)
  with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req,timeout=12) as r:
   data=r.read()
   return r.status,r.headers,json.loads(data) if data else None
 def test_health_and_scenario_shape(self):
  self.assertEqual(self.req("/health")[2]["status"],"ok")
  self.assertEqual(set(self.req("/scenarios")[2][0]),{"id","title","description"})
 def test_demo_endpoint_and_cors(self):
  status,headers,r=self.req("/diagnose",b'{"mode":"demo","scenario":"upstream"}',{"Content-Type":"application/json","Origin":"http://localhost:3000"})
  self.assertEqual(status,200)
  self.assertEqual(headers["Access-Control-Allow-Origin"],"http://localhost:3000")
  self.assertEqual(r["diagnosis"]["code"],"upstream")
 def test_preflight(self):
  code,headers,_=self.req("/diagnose",headers={"Origin":"http://localhost:3000"},verb="OPTIONS")
  self.assertEqual(code,204)
  self.assertIn("POST",headers["Access-Control-Allow-Methods"])
 def test_untrusted_web_origin_is_rejected(self):
  with self.assertRaises(HTTPError) as ctx:
   self.req("/diagnose",b'{"mode":"live"}',{"Content-Type":"application/json","Origin":"https://unsafe.invalid"})
  ctx.exception.close()
  self.assertEqual(ctx.exception.code,403)
 def test_unknown_payload_target_is_rejected(self):
  with self.assertRaises(HTTPError) as ctx:
   self.req("/diagnose",b'{"mode":"live","target":"unsafe.invalid"}',{"Content-Type":"application/json"})
  ctx.exception.close()
  self.assertEqual(ctx.exception.code,400)
 def test_payload_size_is_bounded(self):
  with self.assertRaises(HTTPError) as ctx:
   self.req("/diagnose",b" "*4097,{"Content-Type":"application/json"})
  ctx.exception.close()
  self.assertEqual(ctx.exception.code,413)
 def test_wrong_content_type_cannot_trigger_measurements(self):
  with self.assertRaises(HTTPError) as ctx:
   self.req("/diagnose",b'{"mode":"live"}',{"Content-Type":"text/plain"})
  ctx.exception.close()
  self.assertEqual(ctx.exception.code,415)
if __name__=="__main__":unittest.main()
