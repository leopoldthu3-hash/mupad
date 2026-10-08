import json,subprocess,time,shutil
from pathlib import Path

def call(*args):return subprocess.check_output(args,text=True).strip()
listing=json.loads(call('xcrun','simctl','list','devices','available','--json'))
devices=[d for group in listing['devices'].values() for d in group if 'iPad' in d['name'] and d.get('isAvailable',True)]
if not devices:raise SystemExit('No available iPad simulator; native behavior unverified')
device=devices[0]['udid']
if devices[0]['state']!='Booted':subprocess.run(['xcrun','simctl','boot',device],check=True)
subprocess.run(['xcrun','simctl','bootstatus',device,'-b'],check=True)
subprocess.run(['xcrun','simctl','install',device,'sim-build/Build/Products/Debug-iphonesimulator/App.app'],check=True)
container=Path(call('xcrun','simctl','get_app_container',device,'no.leopold.mupad','data'))
result=container/'Documents/MuPad-selftest.json'
result.unlink(missing_ok=True)
subprocess.run(['xcrun','simctl','launch',device,'no.leopold.mupad','--mupad-selftest'],check=True)
passed=False;previous=None
try:
 for attempt in range(70):
  if result.exists():
   text=result.read_text();report=json.loads(text)
   if text!=previous:print(text,flush=True);previous=text
   if report.get('status') in ('passed','failed'):
    passed=report['status']=='passed';break
  time.sleep(2)
finally:
 subprocess.run(['xcrun','simctl','io',device,'screenshot','native-screenshot.png'])
 for name in ['MuPad-selftest.json','MuPad-checkpoints.jsonl']:
  file=container/'Documents'/name
  if file.exists():shutil.copyfile(file,'native-test-result.json' if name.endswith('selftest.json') else 'native-checkpoints.jsonl')
 logs=subprocess.run(['xcrun','simctl','spawn',device,'log','show','--last','6m','--style','compact','--predicate','process == "App" OR process CONTAINS "WebKit"'],capture_output=True,text=True,timeout=60)
 Path('native-console.log').write_text(logs.stdout+logs.stderr)
if not passed:raise SystemExit('Native WKWebView checks failed; see checkpoint, screenshot and console artifacts')
