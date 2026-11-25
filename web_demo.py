"""Start the static NetDoctor web build and local Python API without npm or Wi-Fi."""
import functools, http.server, pathlib, sys, threading, urllib.request
root=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(root/"backend"))
import server

def main():
 expected=root/"web"/"out"
 if not (expected/"index.html").is_file():raise SystemExit("Static build is missing.")
 cls=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(expected))
 try: web=http.server.ThreadingHTTPServer(("127.0.0.1",8766),cls)
 except OSError:raise SystemExit("Port 8766 is in use. Close the other web demo; this launcher changes no other service.")
 with web:
  server.ORIGINS.update({"http://127.0.0.1:8766","http://localhost:8766"})
  try: api=server.ThreadingHTTPServer(("127.0.0.1",8765),server.Handler)
  except OSError:
   raise SystemExit("Port 8765 is busy. Close the NetDoctor desktop or Python service first. This launcher changes no other service.")
  worker=threading.Thread(target=api.serve_forever,daemon=True)
  worker.start()
  print("NetDoctor is ready. Open http://127.0.0.1:8766 in your browser.",flush=True)
  print("Press Ctrl+C to stop both the web app and the measurement service.",flush=True)
  try: web.serve_forever()
  except KeyboardInterrupt: pass
  finally: api.shutdown();api.server_close();worker.join(2)
if __name__=="__main__":main()
