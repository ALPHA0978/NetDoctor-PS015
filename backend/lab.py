"""Repeatable, real socket measurements against a private 127.0.0.1 fault lab.

No OS routes, adapters, DNS settings, firewalls, or Internet targets are changed.
A local service models a gateway; the measurements are real, but not field data.
"""
from __future__ import annotations
import contextlib, socket, struct, threading, time, statistics

HOST="127.0.0.1"
_TIMEOUT=.65
QUERY=bytes.fromhex("145201000001000000000000036c616207696e76616c69640000010001")
DNS_OK=bytes.fromhex("145281800001000100000000")+QUERY[12:]+bytes.fromhex("c00c000100010000000000047f000001")
DNS_FAIL=bytes.fromhex("145281820001000000000000")+QUERY[12:]

def tcp_listener():
 s=socket.socket()
 s.bind((HOST,0));s.listen(8);s.settimeout(1.4)
 return s

def recv_exact(sock,n):
 result=bytearray()
 while len(result)<n:
  data=sock.recv(min(n-len(result),32768))
  if not data: break
  result.extend(data)
 return bytes(result)

def gateway(missing):
 with tcp_listener() as listener:
  port=listener.getsockname()[1]
  if missing:
   # Reserve an ephemeral port without a listening socket: deterministic refused route surrogate.
   with socket.socket() as down:
    down.bind((HOST,0))
    return gateway_client(down.getsockname()[1])
  def serve():
   try:
    with listener.accept()[0] as conn: conn.sendall(b"G")
   except OSError: pass
  worker=threading.Thread(target=serve,daemon=True);worker.start()
  ms=gateway_client(port);worker.join(1.5);return ms

def gateway_client(port):
 t=time.perf_counter()
 try:
  with socket.create_connection((HOST,port),timeout=_TIMEOUT) as client:
   return round((time.perf_counter()-t)*1000,3) if client.recv(1)==b"G" else None
 except OSError: return None

def udp_server(reply):
 sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
 sock.bind((HOST,0));sock.settimeout(.08)
 stop=threading.Event()
 def run():
  while not stop.is_set():
   try:
    data,peer=sock.recvfrom(256)
    response=reply(data)
    if response is not None: sock.sendto(response,peer)
   except TimeoutError: pass
   except OSError: break
 worker=threading.Thread(target=run,daemon=True);worker.start()
 @contextlib.contextmanager
 def managed():
  try:yield sock.getsockname()
  finally:
   stop.set();sock.close();worker.join(.2)
 return managed()

def dns(fail):
 with udp_server(lambda q:(DNS_FAIL if fail else DNS_OK) if q==QUERY else None) as peer, socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as client:
  client.settimeout(_TIMEOUT);t=time.perf_counter();client.sendto(QUERY,peer)
  try: reply,_=client.recvfrom(128)
  except OSError:return None,"timeout"
  if len(reply)<12 or reply[:2]!=QUERY[:2]: return None,"invalid"
  elapsed=round((time.perf_counter()-t)*1000,3)
  rcode=reply[3]&15
  answers=struct.unpack_from("!H",reply,6)[0]
  return elapsed,("response" if rcode==0 and answers else {2:"SERVFAIL",3:"NXDOMAIN"}.get(rcode,"no answer"))

def datagrams(loss):
 drops={2,5,8} if loss else set()
 samples=[]
 with udp_server(lambda q:q if q and q[0] not in drops else None) as peer, socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as client:
  client.settimeout(.09)
  for i in range(10):
   data=bytes([i])+b"NDR"
   t=time.perf_counter();client.sendto(data,peer)
   try:
    reply,_=client.recvfrom(32)
    elapsed=round((time.perf_counter()-t)*1000,3)
    samples.append(elapsed if data==reply else None)
   except OSError:samples.append(None)
 return samples

def queue_probe(congested):
 """A bounded 512 KiB transfer and two sets of latency probes on a local serialized link."""
 with tcp_listener() as listener:
  port=listener.getsockname()[1]; chunk=b"N"*16384; started=threading.Event()
  arbiter=threading.Lock()
  def serve(conn):
   with conn:
    conn.settimeout(1.2)
    try:
     request=conn.recv(1)
     if request==b"B":
      # The congestion fault holds the simulated link while servicing a realistically paced stream.
      with (arbiter if congested else contextlib.nullcontext()):
       started.set()
       for _ in range(32):
        conn.sendall(chunk);time.sleep(.009)
     elif request==b"P":
      with arbiter: conn.sendall(b"P")
    except OSError: pass
  def accept():
   children=[]
   try:
    for _ in range(7):
     c,_=listener.accept()
     child=threading.Thread(target=serve,args=(c,),daemon=True);child.start();children.append(child)
   except OSError: pass
   finally:
    for child in children:child.join(1.3)
  parent=threading.Thread(target=accept,daemon=True);parent.start()
  def ping():
   t=time.perf_counter()
   try:
    with socket.create_connection((HOST,port),timeout=1) as client:
     client.sendall(b"P")
     return round((time.perf_counter()-t)*1000,3) if client.recv(1)==b"P" else None
   except OSError:return None
  base=[ping() for _ in range(3)]
  rate=[None]; size=[0]
  def load():
   start=time.perf_counter()
   try:
    with socket.create_connection((HOST,port),timeout=1) as client:
     client.sendall(b"B");size[0]=len(recv_exact(client,512*1024))
     rate[0]=round(size[0]*8/(time.perf_counter()-start)/1e6,3)
   except OSError:pass
  worker=threading.Thread(target=load,daemon=True);worker.start()
  started.wait(_TIMEOUT)
  # Start all three loaded RTT samples together while the transfer is in flight.
  loaded=[None]*3
  def record(i):loaded[i]=ping()
  jobs=[threading.Thread(target=record,args=(i,),daemon=True) for i in range(3)]
  for j in jobs:j.start()
  for j in jobs:j.join(1.2)
  worker.join(1.3);parent.join(1.2)
  return base,loaded,rate[0],size[0]

def median(values):
 return round(statistics.median(good),3) if (good:=[x for x in values if x is not None]) else None
def classify(m):
 if m["gateway_ms"] is None and m["dns_status"]=="response" and m["received"]>=9: return "gateway_unreachable"
 if m["gateway_ms"] is None or m["dns_status"] in ("timeout","invalid"):return "inconclusive"
 if m["dns_status"]=="SERVFAIL" and m["received"]>=9:return "dns"
 if m["dns_status"]!="response":return "inconclusive"
 if m["received"] in range(1,9) and m["sent"]==10:return "packet_loss"
 if m["received"]!=m["sent"]:return "inconclusive"
 if m["loaded_ms"] is None or m["idle_ms"] is None or m["bytes"]!=512*1024:return "inconclusive"
 if m["loaded_ms"]-m["idle_ms"]>100:return "congestion"
 return "healthy"

def run(fault):
 if fault not in ("control","gateway","dns","packet_loss","congestion","ambiguous"):
  raise ValueError("Unknown loopback lab condition.")
 g=gateway(fault in ("gateway","ambiguous"))
 d,status=dns(fault in ("dns","ambiguous"))
 p=datagrams(fault=="packet_loss")
 base,loaded,rate,size=queue_probe(fault=="congestion")
 count=sum(x is not None for x in p)
 return {"gateway_ms":g,"dns_ms":d,"dns_status":status,"sent":len(p),"received":count,
         "loss_pct":(len(p)-count)*100/len(p),
         "idle_rtt_ms":base,"loaded_rtt_ms":loaded,"idle_ms":median(base),"loaded_ms":median(loaded),
         "loaded_jitter_ms":round(max(good)-min(good),3) if len(good:=[x for x in loaded if x is not None])>=2 else None,
         "throughput_mbps":rate,"bytes":size}
