from http.server import ThreadingHTTPServer
import json
import os
import threading
import unittest
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError
from urllib.request import Request,build_opener,ProxyHandler
import gemini_evidence as ai
import server

class EvidenceTests(unittest.TestCase):
 def setUp(self):
  self.report=server.outcome({"mode":"live"},(True,[1,2,3,4],[10,12],[70,80],True))
 def test_only_allowlisted_observations_can_leave_the_device(self):
  self.report["secret"]="private value"
  self.report["measurements"].append({"id":"192.168.44.1","status":"fail","value":"secret"})
  self.report["measurements"][0]["detail"]="ssid-private"
  snap=ai.public_snapshot(self.report)
  encoded=json.dumps(snap)
  for unwanted in ("ssid-private","192.168.44.1","private value",self.report["id"],"created_at"):
   self.assertNotIn(unwanted,encoded)
  self.assertEqual(snap["verdict"],"healthy")
 def test_model_cannot_override_or_invent(self):
  snap=ai.public_snapshot(self.report)
  for invalid in ({"evidence_ids":["missing"],"next_action":0},{"evidence_ids":["gateway"],"next_action":99},{"evidence_ids":["gateway"],"next_action":0,"verdict":"upstream"}):
   with self.assertRaises(ValueError):ai.validate(invalid,snap)
 def test_mocked_gemini_http_contract_and_cached_result(self):
  ai.record(self.report)
  with patch.dict(os.environ,{"GEMINI_API_KEY":"test-key"}),patch.object(ai.http.client,"HTTPSConnection") as conn:
   exchange=conn.return_value
   exchange.getresponse.return_value.status=200
   exchange.getresponse.return_value.read.return_value=json.dumps({"steps":[{"type":"model_output","content":[{"type":"text","text":"{\"evidence_ids\":[\"gateway\"],\"next_action\":0}"}]}]}).encode()
   result=ai.explain(self.report["id"])
   self.assertEqual(result["evidence_ids"],["gateway"])
   self.assertEqual(ai.explain(self.report["id"]),result)
   exchange.request.assert_called_once()
   args,kwargs=exchange.request.call_args
   self.assertEqual(args,("POST","/v1beta/interactions"))
   self.assertEqual(kwargs["headers"]["x-goog-api-key"],"test-key")
   payload=json.loads(kwargs["body"])
   self.assertIs(payload["store"],False)
   self.assertEqual(payload["model"],"gemini-3.8-flash")
   self.assertEqual(payload["generation_config"],{"thinking_level":"low","max_output_tokens":2048})
   self.assertNotIn(self.report["id"],kwargs["body"].decode())
 def test_provider_errors_use_safe_messages(self):
  error={"error":{"message":"sensitive provider text","details":[{"reason":"API_KEY_INVALID"}]}}
  with patch.dict(os.environ,{"GEMINI_API_KEY":"test-key"}),patch.object(ai.http.client,"HTTPSConnection") as conn:
   response=conn.return_value.getresponse.return_value
   response.status=400
   response.read.return_value=json.dumps(error).encode()
   with self.assertRaises(ai.GeminiError) as failure:ai.rank(ai.public_snapshot(self.report))
   self.assertEqual(failure.exception.code,"invalid_key")
   self.assertNotIn("sensitive provider text",str(failure.exception))
   response.status=200
   response.read.return_value=b'{"status":"incomplete","steps":[]}'
   with self.assertRaises(ai.GeminiError) as failure:ai.rank(ai.public_snapshot(self.report))
   self.assertEqual(failure.exception.code,"incomplete")
 def test_synthetic_report_cannot_be_explained(self):
  r=server.outcome({"mode":"demo","scenario":"healthy"})
  ai.record(r)
  with self.assertRaises(KeyError):ai.explain(r["id"])
 def test_http_requires_consent_and_rejects_missing_key(self):
  app=ThreadingHTTPServer(("127.0.0.1",0),server.Handler)
  thread=threading.Thread(target=app.serve_forever,daemon=True);thread.start()
  def explain(payload):
   request=Request(f"http://127.0.0.1:{app.server_port}/explain",json.dumps(payload).encode(),{"Content-Type":"application/json"})
   return build_opener(ProxyHandler({})).open(request,timeout=2)
  try:
   with patch.dict(os.environ,{"GEMINI_API_KEY":""}):
    with self.assertRaises(HTTPError) as e:explain({"run_id":"private","consent":True})
    self.assertEqual(e.exception.code,503);e.exception.close()
   with patch.dict(os.environ,{"GEMINI_API_KEY":"test-key"}):
    with self.assertRaises(HTTPError) as e:explain({"run_id":"private","consent":False})
    self.assertEqual(e.exception.code,400);e.exception.close()
  finally:app.shutdown();app.server_close();thread.join(2)
