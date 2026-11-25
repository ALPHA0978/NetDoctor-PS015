"""Bounded, read-only host observations and platform adapters."""
import concurrent.futures
import http.client
import ipaddress
import platform
import re
import socket
import subprocess
import time

TARGETS = ("www.cloudflare.com", "www.google.com")
def command(args, timeout=6):
 try:
  p=subprocess.run(args, capture_output=True, text=True, errors="replace", timeout=timeout, shell=False,
      creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
  return p.returncode,p.stdout
 except (OSError,subprocess.SubprocessError):
  return None,""

def gateway():
 if platform.system()=="Windows":
  _,out=command(["route.exe","PRINT","-4"])
  candidates=[]
  for line in out.splitlines():
   match=re.match(r"^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\S+)\s+\S+\s+(\d+)\s*$",line)
   if not match: continue
   try:
    ip=ipaddress.IPv4Address(match[1])
    if ip.is_private and not (ip.is_loopback or ip.is_multicast or ip.is_unspecified):
     candidates.append((int(match[2]),str(ip)))
   except ValueError: continue
  return min(candidates)[1] if candidates else None
 if platform.system()=="Darwin":
  _,out=command(["route","-n","get","default"])
  match=re.search(r"gateway:\s+(\S+)",out)
 else:
  _,out=command(["ip","-4","route","show","default"])
  match=re.search(r"\bvia\s+(\S+)",out)
 try:
  ip=ipaddress.IPv4Address(match[1]) if match else None
  return str(ip) if ip and ip.is_private and not (ip.is_loopback or ip.is_multicast or ip.is_unspecified) else None
 except ValueError: return None

def local_probes(ip):
 if not ip: return []
 args = (["ping.exe","-n","1","-w","650",ip] if platform.system()=="Windows"
   else ["ping","-n","-c","1",ip])
 out=[]
 for _ in range(4):
  start=time.monotonic()
  status,data=command(args,1.4)
  match=re.search(r"[=<]\s*(\d+(?:[.,]\d+)?)\s*ms\b",data,re.I)
  out.append(float(match[1].replace(",",".")) if match and status==0 else
   (round((time.monotonic()-start)*1000,1) if status==0 and platform.system()=="Windows" and "TTL=" in data.upper() else None))
 return out

def resolve(host):
 start=time.monotonic()
 try:
  socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)
  return round((time.monotonic()-start)*1000,1)
 except OSError: return None

def https_probe(host):
 start=time.monotonic()
 conn=http.client.HTTPSConnection(host,443,timeout=2.5)
 try:
  conn.request("HEAD","/",headers={"User-Agent":"NetDoctor-PS015/1.0"})
  response=conn.getresponse()
  return round((time.monotonic()-start)*1000,1) if 200<=response.status<600 else None
 except (OSError,http.client.HTTPException): return None
 finally: conn.close()

def direct_ip():
 try:
  with socket.create_connection(("1.1.1.1",443),timeout=1.7): return True
 except OSError: return False

def measure():
 ip=gateway()
 # DNS/HTTPS are intentionally limited to two named hosts; no scanning, custom targets, or downloads.
 pool=concurrent.futures.ThreadPoolExecutor(max_workers=6)
 jobs=[pool.submit(local_probes,ip),*(pool.submit(resolve,h) for h in TARGETS),
  *(pool.submit(https_probe,h) for h in TARGETS),pool.submit(direct_ip)]
 try:
  concurrent.futures.wait(jobs,timeout=7)
  vals=[j.result() if j.done() and not j.exception() else None for j in jobs]
  return bool(ip),vals[0] or [],vals[1:3],vals[3:5],vals[5]
 finally:
  pool.shutdown(wait=False,cancel_futures=True)

